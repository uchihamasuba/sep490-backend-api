import { prisma } from '../../db/prisma';

// Tài khoản ngân hàng công ty lưu dạng SINGLETON (chỉ 1 hàng). Không có API tạo nhiều — mọi cập nhật
// đều upsert lên đúng hàng đang có (nếu chưa có thì tạo mới).
export const settingsRepository = {
  getBankAccount() {
    return prisma.companyBankAccount.findFirst({ orderBy: { updatedAt: 'desc' } });
  },

  async upsertBankAccount(data: {
    bankBin: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    updatedBy: string | null;
  }) {
    const existing = await prisma.companyBankAccount.findFirst();
    if (existing) {
      return prisma.companyBankAccount.update({ where: { id: existing.id }, data });
    }
    return prisma.companyBankAccount.create({ data });
  },
};
