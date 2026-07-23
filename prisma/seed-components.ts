import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const category = await prisma.itemCategory.upsert({
    where: { categoryCode: 'FURNITURE_TEST' },
    update: {},
    create: { categoryCode: 'FURNITURE_TEST', categoryName: 'Nội thất Test' },
  });

  const type = await prisma.itemType.upsert({
    where: { typeId: 'type-test-01' },
    update: {},
    create: { typeId: 'type-test-01', categoryId: category.categoryId, typeCode: 'TYPE_TEST', typeName: 'Bàn ghế test' },
  });

  const item1 = await prisma.item.upsert({
    where: { itemCode: 'it1' },
    update: {},
    create: { itemId: 'it1', itemCode: 'it1', itemName: 'GHẾ A', rentalPrice: 10000, unit: 'cái', typeId: type.typeId },
  });

  const item2 = await prisma.item.upsert({
    where: { itemCode: 'it2' },
    update: {},
    create: { itemId: 'it2', itemCode: 'it2', itemName: 'Bàn A', rentalPrice: 15000, unit: 'cái', typeId: type.typeId },
  });

  const item3 = await prisma.item.upsert({
    where: { itemCode: 'it3' },
    update: {},
    create: { itemId: 'it3', itemCode: 'it3', itemName: 'Bộ bàn ghế A', rentalPrice: 20000, unit: 'bộ', typeId: type.typeId },
  });

  await prisma.itemComponent.createMany({
    data: [
      { id: 'ic1', parentId: item3.itemId, childId: item1.itemId, quantity: 10 },
      { id: 'ic2', parentId: item3.itemId, childId: item2.itemId, quantity: 1 },
    ],
    skipDuplicates: true,
  });

  console.log('Đã seed thành công cấu trúc BOM cho Bộ Bàn Ghế A!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
