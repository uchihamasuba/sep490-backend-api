import { policyRepository } from '../policy.repository';
import { prisma } from '../../../db/prisma';

jest.mock('../../../db/prisma', () => ({
  prisma: {
    businessPolicy: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('policyRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findMany with filters', async () => {
    (prisma.businessPolicy.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.businessPolicy.count as jest.Mock).mockResolvedValue(0);

    const result = await policyRepository.findMany({
      policyType: 'DEPOSIT',
      isActive: true,
      search: 'test',
      skip: 0,
      take: 10,
    });

    expect(prisma.businessPolicy.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        policyType: 'DEPOSIT',
        isActive: true,
        OR: [{ policyName: { contains: 'test' } }, { policyCode: { contains: 'test' } }],
      },
      skip: 0,
      take: 10,
    }));
    expect(result).toEqual({ rows: [], totalItems: 0 });
  });

  it('findById', async () => {
    await policyRepository.findById('p1');
    expect(prisma.businessPolicy.findUnique).toHaveBeenCalledWith({ where: { policyId: 'p1' } });
  });

  it('findByCode', async () => {
    await policyRepository.findByCode('CODE1');
    expect(prisma.businessPolicy.findUnique).toHaveBeenCalledWith({ where: { policyCode: 'CODE1' } });
  });

  it('create', async () => {
    const data = {
      policyCode: 'C1',
      policyName: 'N1',
      policyType: 'FEE' as const,
      policyValue: 10,
      unit: '%',
      description: null,
    };
    await policyRepository.create(data);
    expect(prisma.businessPolicy.create).toHaveBeenCalledWith({ data });
  });

  it('update', async () => {
    const data = { policyValue: 20, isActive: false };
    await policyRepository.update('p1', data);
    expect(prisma.businessPolicy.update).toHaveBeenCalledWith({
      where: { policyId: 'p1' },
      data,
    });
  });
});
