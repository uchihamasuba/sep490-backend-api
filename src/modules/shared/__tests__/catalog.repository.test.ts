import { catalogRepository, catalogCategoryRepository, catalogTypeRepository } from '../catalog.repository';
import { prisma } from '../../../db/prisma';

jest.mock('../../../db/prisma', () => ({
  prisma: {
    item: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    itemCategory: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    itemType: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    itemComponent: {
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((promises) => Promise.all(promises)),
  },
}));

describe('Catalog Repositories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('catalogRepository', () => {
    it('findMany uses filters and pagination', async () => {
      (prisma.item.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.item.count as jest.Mock).mockResolvedValue(0);

      const result = await catalogRepository.findMany({
        status: 'ACTIVE',
        typeId: 't1',
        categoryId: 'c1',
        search: 'test',
        isCombo: true,
        skip: 10,
        take: 5,
      });

      expect(prisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          status: 'ACTIVE',
          typeId: 't1',
          type: { categoryId: 'c1' },
          itemName: { contains: 'test' },
          components: { some: {} },
        },
        skip: 10,
        take: 5,
      }));
      expect(result).toEqual({ rows: [], totalItems: 0 });
    });

    it('generateNextItemCode generates code', async () => {
      (prisma.item.count as jest.Mock).mockResolvedValue(42);
      const code = await catalogRepository.generateNextItemCode();
      expect(code).toBe('ITM-043');
    });

    it('create inserts items with components', async () => {
      (prisma.item.create as jest.Mock).mockResolvedValue({ itemId: '1' });
      await catalogRepository.create({
        itemCode: 'ITM-01',
        itemName: 'Test',
        typeId: 't1',
        description: null,
        unit: 'pc',
        rentalPrice: 10,
        purchasePrice: null,
        priceValidFrom: null,
        priceValidTo: null,
        imageUrl: null,
        status: 'ACTIVE',
        components: [{ componentItemId: 'c1', quantity: 2 }],
      });
      expect(prisma.item.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          components: { create: [{ childId: 'c1', quantity: 2 }] },
        }),
      }));
    });

    it('update updates items with components using transaction', async () => {
      (prisma.item.update as jest.Mock).mockResolvedValue({});
      (prisma.item.findUniqueOrThrow as jest.Mock).mockResolvedValue({ itemId: '1' });

      await catalogRepository.update('1', {
        itemName: 'Test',
        typeId: 't1',
        description: null,
        unit: 'pc',
        rentalPrice: 10,
        purchasePrice: null,
        priceValidFrom: null,
        priceValidTo: null,
        imageUrl: null,
        components: [{ componentItemId: 'c1', quantity: 2 }],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.itemComponent.deleteMany).toHaveBeenCalledWith({ where: { parentId: '1' } });
      expect(prisma.item.update).toHaveBeenCalled();
    });

    it('update updates items without components', async () => {
      (prisma.item.update as jest.Mock).mockResolvedValue({ itemId: '1' });
      await catalogRepository.update('1', {
        itemName: 'Test',
        typeId: 't1',
        description: null,
        unit: 'pc',
        rentalPrice: 10,
        purchasePrice: null,
        priceValidFrom: null,
        priceValidTo: null,
        imageUrl: null,
      });

      expect(prisma.item.update).toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updateStatus updates status', async () => {
      await catalogRepository.updateStatus('1', 'INACTIVE');
      expect(prisma.item.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { itemId: '1' },
        data: { status: 'INACTIVE' },
      }));
    });

    it('findComponentsByItemId', async () => {
      await catalogRepository.findComponentsByItemId('1');
      expect(prisma.itemComponent.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { parentId: '1' },
      }));
    });
  });

  describe('catalogCategoryRepository', () => {
    it('findMany', async () => {
      (prisma.itemCategory.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.itemCategory.count as jest.Mock).mockResolvedValue(0);
      await catalogCategoryRepository.findMany({ search: 'test', skip: 0, take: 10 });
      expect(prisma.itemCategory.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { categoryName: { contains: 'test' } },
      }));
    });

    it('findById', async () => {
      await catalogCategoryRepository.findById('c1');
      expect(prisma.itemCategory.findUnique).toHaveBeenCalledWith({ where: { categoryId: 'c1' } });
    });

    it('create', async () => {
      await catalogCategoryRepository.create({ categoryName: 'Test', description: null });
      expect(prisma.itemCategory.create).toHaveBeenCalled();
    });

    it('update', async () => {
      await catalogCategoryRepository.update('c1', { categoryName: 'Test', description: null });
      expect(prisma.itemCategory.update).toHaveBeenCalled();
    });
  });

  describe('catalogTypeRepository', () => {
    it('findMany', async () => {
      (prisma.itemType.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.itemType.count as jest.Mock).mockResolvedValue(0);
      await catalogTypeRepository.findMany({ categoryId: 'c1', search: 'test', skip: 0, take: 10 });
      expect(prisma.itemType.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { categoryId: 'c1', typeName: { contains: 'test' } },
      }));
    });

    it('findById', async () => {
      await catalogTypeRepository.findById('t1');
      expect(prisma.itemType.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { typeId: 't1' } }));
    });

    it('create', async () => {
      await catalogTypeRepository.create({ categoryId: 'c1', typeName: 'Test', description: null });
      expect(prisma.itemType.create).toHaveBeenCalled();
    });

    it('update', async () => {
      await catalogTypeRepository.update('t1', { categoryId: 'c1', typeName: 'Test', description: null });
      expect(prisma.itemType.update).toHaveBeenCalled();
    });

    it('updateStatus', async () => {
      await catalogTypeRepository.updateStatus('t1', false);
      expect(prisma.itemType.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { typeId: 't1' },
        data: { isActive: false },
      }));
    });
  });
});
