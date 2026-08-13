import { reportRepository } from './report.repository';

export const reportService = {
  async getRevenueReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    
    // ==========================================
    // LUỒNG 1: HIỆU QUẢ DỰ ÁN (P&L by Event Date)
    // ==========================================
    const committedOrders = await reportRepository.getCommittedOrders(start, end);
    const orderIds = committedOrders.map(o => o.orderId);

    const relatedSupplierTx = await reportRepository.getRelatedSupplierTransactions(orderIds);
    const relatedDeposits = await reportRepository.getRelatedDeposits(orderIds);
    const relatedSettlements = await reportRepository.getRelatedSettlements(orderIds);

    // Gom nhóm chi phí và thu tiền theo orderId
    const supplierCostByOrder = new Map<string, number>();
    for (const tx of relatedSupplierTx) {
      if (tx.orderId) {
        supplierCostByOrder.set(tx.orderId, (supplierCostByOrder.get(tx.orderId) ?? 0) + Number(tx.estimatedCost));
      }
    }

    const collectedByOrder = new Map<string, number>();
    for (const d of relatedDeposits) {
      collectedByOrder.set(d.orderId, (collectedByOrder.get(d.orderId) ?? 0) + Number(d.amount));
    }
    for (const s of relatedSettlements) {
      collectedByOrder.set(s.orderId, (collectedByOrder.get(s.orderId) ?? 0) + Number(s.finalAmount));
    }

    let plCommitted = 0;
    let plCollected = 0;
    let plSupplierCost = 0;
    let completedCount = 0;

    const plMonthlyMap = new Map<string, { committed: number, collected: number }>();
    const topCustomersMap = new Map<string, number>();
    const eventTypeMap = new Map<string, number>();
    
    for (const order of committedOrders) {
      const amount = Number(order.totalAmount);
      const collected = collectedByOrder.get(order.orderId) ?? 0;
      const cost = supplierCostByOrder.get(order.orderId) ?? 0;

      plCommitted += amount;
      plCollected += collected;
      plSupplierCost += cost;

      if (order.orderStatus === 'COMPLETED') completedCount++;

      // Gom theo tháng (YYYY-MM)
      const monthKey = order.eventDate.toISOString().slice(0, 7);
      const currentMonth = plMonthlyMap.get(monthKey) ?? { committed: 0, collected: 0 };
      currentMonth.committed += amount;
      currentMonth.collected += collected;
      plMonthlyMap.set(monthKey, currentMonth);

      // Top customers
      const cName = order.customer?.customerName || 'Khách lẻ';
      topCustomersMap.set(cName, (topCustomersMap.get(cName) ?? 0) + amount);

      // Event types
      const eType = order.eventType || 'Khác';
      eventTypeMap.set(eType, (eventTypeMap.get(eType) ?? 0) + amount);
    }

    const plOutstanding = Math.max(0, plCommitted - plCollected);
    const plCollectionRate = plCommitted > 0 ? plCollected / plCommitted : 0;
    const plRevenueAfterSupplier = plCommitted - plSupplierCost;
    const plAov = committedOrders.length > 0 ? plCommitted / committedOrders.length : 0;

    const topCustomers = Array.from(topCustomersMap.entries())
      .map(([name, revenue]) => ({ name: name.length > 16 ? `${name.slice(0, 15)}…` : name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const byType = Array.from(eventTypeMap.entries())
      .map(([eventType, revenue]) => ({ eventType, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Sinh danh sách tháng đầy đủ trong khoảng
    const monthKeys: string[] = [];
    let curr = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (curr <= endMonth) {
      monthKeys.push(curr.toISOString().slice(0, 7));
      curr.setMonth(curr.getMonth() + 1);
    }

    const monthlyProfitability = monthKeys.map(key => {
      const parts = key.split('-');
      const label = `${parts[1]}/${parts[0]}`;
      const data = plMonthlyMap.get(key) || { committed: 0, collected: 0 };
      return {
        month: label,
        committed: data.committed,
        collected: data.collected,
        outstanding: Math.max(0, data.committed - data.collected)
      };
    });

    const collectionDonut = [
      { label: 'Đã thu', value: plCollected, color: '#16a34a' },
      { label: 'Còn phải thu', value: plOutstanding, color: '#f59e0b' },
    ].filter(s => s.value > 0);

    // ==========================================
    // LUỒNG 2: DÒNG TIỀN MẶT (Cash-flow by Date)
    // ==========================================
    
    const depositsIn = await reportRepository.getPaidDepositsInPeriod(start, end);
    const settlementsIn = await reportRepository.getPaidSettlementsInPeriod(start, end);
    const supplierOut = await reportRepository.getSupplierTransactionsInPeriod(start, end);

    const cfMonthlyMap = new Map<string, { cashIn: number, cashOut: number }>();
    
    let totalCashIn = 0;
    let totalCashOut = 0;

    const addCf = (date: Date | null, inAmt: number, outAmt: number) => {
      if (!date) return;
      const key = date.toISOString().slice(0, 7);
      const cur = cfMonthlyMap.get(key) ?? { cashIn: 0, cashOut: 0 };
      cur.cashIn += inAmt;
      cur.cashOut += outAmt;
      cfMonthlyMap.set(key, cur);
      totalCashIn += inAmt;
      totalCashOut += outAmt;
    };

    for (const d of depositsIn) addCf(d.paymentDate, Number(d.amount), 0);
    for (const s of settlementsIn) addCf(s.paidAt, Number(s.finalAmount), 0);
    for (const o of supplierOut) addCf(o.createdAt, 0, Number(o.estimatedCost));

    const monthlyCashFlow = monthKeys.map(key => {
      const parts = key.split('-');
      const label = `${parts[1]}/${parts[0]}`;
      const data = cfMonthlyMap.get(key) || { cashIn: 0, cashOut: 0 };
      return {
        month: label,
        cashIn: data.cashIn,
        cashOut: data.cashOut,
        netCashFlow: data.cashIn - data.cashOut
      };
    });

    // ==========================================
    // LUỒNG 3: NỢ ĐỌNG QUÁ HẠN (Unpaid Settlements)
    // ==========================================
    const completedOrdersQuery = await reportRepository.getCompletedOrders();
    
    let totalOutstandingDebt = 0;
    const compOrderIds = completedOrdersQuery.map(o => o.orderId);
    
    if (compOrderIds.length > 0) {
      const cDeposits = await reportRepository.getRelatedDeposits(compOrderIds);
      const cSettlements = await reportRepository.getRelatedSettlements(compOrderIds);
      
      const cCollectedMap = new Map<string, number>();
      for (const d of cDeposits) cCollectedMap.set(d.orderId, (cCollectedMap.get(d.orderId) ?? 0) + Number(d.amount));
      for (const s of cSettlements) cCollectedMap.set(s.orderId, (cCollectedMap.get(s.orderId) ?? 0) + Number(s.finalAmount));
      
      for (const o of completedOrdersQuery) {
        const amt = Number(o.totalAmount);
        const col = cCollectedMap.get(o.orderId) ?? 0;
        const outst = amt - col;
        if (outst > 0) totalOutstandingDebt += outst;
      }
    }

    return {
      profitability: {
        committed: plCommitted,
        collected: plCollected,
        outstanding: plOutstanding,
        collectionRate: plCollectionRate,
        supplierCost: plSupplierCost,
        revenueAfterSupplier: plRevenueAfterSupplier,
        orderCount: committedOrders.length,
        completedCount,
        aov: plAov,
        monthly: monthlyProfitability,
        collectionDonut,
        byType,
        topCustomers
      },
      cashFlow: {
        totalCashIn,
        totalCashOut,
        netCashFlow: totalCashIn - totalCashOut,
        totalOutstandingDebt,
        monthly: monthlyCashFlow
      }
    };
  }
};
