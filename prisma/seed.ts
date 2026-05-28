// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('بدء إدخال البيانات التجريبية...')

  // Create users
  const adminPassword = await bcrypt.hash('Admin@123', 12)
  const opsPassword = await bcrypt.hash('Ops@123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@sahab.ae' },
    update: {},
    create: {
      name: 'مدير النظام',
      email: 'admin@sahab.ae',
      password: adminPassword,
      role: 'ADMIN',
    },
  })

  const ops = await prisma.user.upsert({
    where: { email: 'ops@sahab.ae' },
    update: {},
    create: {
      name: 'مسؤول العمليات',
      email: 'ops@sahab.ae',
      password: opsPassword,
      role: 'OPERATIONS',
    },
  })

  console.log('تم إنشاء المستخدمين:', admin.email, ops.email)

  // Create suppliers
  const supplier1 = await prisma.supplier.upsert({
    where: { id: 'sup-001' },
    update: {},
    create: {
      id: 'sup-001',
      name: 'شركة النور للشاشات والعروض',
      phone: '0501234567',
      email: 'info@alnoor-screens.ae',
      serviceType: 'SCREENS',
      recommendation: 'PRIMARY',
    },
  })

  const supplier2 = await prisma.supplier.upsert({
    where: { id: 'sup-002' },
    update: {},
    create: {
      id: 'sup-002',
      name: 'مؤسسة الصوت المثالي',
      phone: '0557654321',
      email: 'sound@ideal-audio.ae',
      serviceType: 'AUDIO',
      recommendation: 'PRIMARY',
    },
  })

  const supplier3 = await prisma.supplier.upsert({
    where: { id: 'sup-003' },
    update: {},
    create: {
      id: 'sup-003',
      name: 'شركة الضوء الإبداعي للإضاءة',
      phone: '0521112233',
      email: 'light@creative-lighting.ae',
      serviceType: 'LIGHTING',
      recommendation: 'BACKUP',
    },
  })

  const supplier4 = await prisma.supplier.upsert({
    where: { id: 'sup-004' },
    update: {},
    create: {
      id: 'sup-004',
      name: 'مطبعة الخليج للطباعة والنشر',
      phone: '0564445566',
      email: 'print@gulf-print.ae',
      serviceType: 'PRINTING',
      recommendation: 'PRIMARY',
    },
  })

  const supplier5 = await prisma.supplier.upsert({
    where: { id: 'sup-005' },
    update: {},
    create: {
      id: 'sup-005',
      name: 'شركة السجاد الفاخر',
      phone: '0509998877',
      email: 'carpet@luxury-carpet.ae',
      serviceType: 'CARPET',
      recommendation: 'UNDER_REVIEW',
    },
  })

  const supplier6 = await prisma.supplier.upsert({
    where: { id: 'sup-006' },
    update: {},
    create: {
      id: 'sup-006',
      name: 'ورشة النجارة الحديثة',
      phone: '0533334444',
      email: 'wood@modern-carpentry.ae',
      serviceType: 'CARPENTRY',
      recommendation: 'BACKUP',
    },
  })

  const supplier7 = await prisma.supplier.upsert({
    where: { id: 'sup-007' },
    update: {},
    create: {
      id: 'sup-007',
      name: 'استوديو اللحظة للتصوير',
      phone: '0501122334',
      email: 'photo@moment-studio.ae',
      serviceType: 'PHOTOGRAPHY',
      recommendation: 'PRIMARY',
    },
  })

  const supplier8 = await prisma.supplier.upsert({
    where: { id: 'sup-008' },
    update: {},
    create: {
      id: 'sup-008',
      name: 'شركة النقل السريع',
      phone: '0568889900',
      email: 'transport@fast-transport.ae',
      serviceType: 'TRANSPORT',
      recommendation: 'SUSPENDED',
    },
  })

  console.log('تم إنشاء الموردين')

  // Create projects
  const project1 = await prisma.project.upsert({
    where: { code: 'PRJ-001' },
    update: {},
    create: {
      id: 'prj-001',
      code: 'PRJ-001',
      name: 'معرض التقنية الدولي 2024',
      clientName: 'مركز دبي التجاري',
      value: 450000,
      executionDate: new Date('2024-03-15'),
      status: 'COMPLETED',
    },
  })

  const project2 = await prisma.project.upsert({
    where: { code: 'PRJ-002' },
    update: {},
    create: {
      id: 'prj-002',
      code: 'PRJ-002',
      name: 'حفل تدشين منتج شركة الاتصالات',
      clientName: 'شركة الاتصالات الإماراتية',
      value: 180000,
      executionDate: new Date('2024-04-20'),
      status: 'COMPLETED',
    },
  })

  const project3 = await prisma.project.upsert({
    where: { code: 'PRJ-003' },
    update: {},
    create: {
      id: 'prj-003',
      code: 'PRJ-003',
      name: 'مؤتمر القيادة والإدارة 2024',
      clientName: 'غرفة تجارة وصناعة أبوظبي',
      value: 320000,
      executionDate: new Date('2024-05-10'),
      status: 'IN_PROGRESS',
    },
  })

  const project4 = await prisma.project.upsert({
    where: { code: 'PRJ-004' },
    update: {},
    create: {
      id: 'prj-004',
      code: 'PRJ-004',
      name: 'معرض المواد الغذائية الدولي',
      clientName: 'شركة الخليج للأغذية',
      value: 550000,
      executionDate: new Date('2024-06-05'),
      status: 'CONFIRMED',
    },
  })

  const project5 = await prisma.project.upsert({
    where: { code: 'PRJ-005' },
    update: {},
    create: {
      id: 'prj-005',
      code: 'PRJ-005',
      name: 'حفل توزيع جوائز التميز',
      clientName: 'مجلس تنمية رأس الخيمة',
      value: 95000,
      executionDate: new Date('2024-07-15'),
      status: 'QUOTE',
    },
  })

  console.log('تم إنشاء المشاريع')

  // Create bills
  await prisma.bill.upsert({
    where: { id: 'bill-001' },
    update: {},
    create: {
      id: 'bill-001',
      billNumber: 'INV-2024-0101',
      supplierId: supplier1.id,
      projectId: project1.id,
      amount: 85000,
      billDate: new Date('2024-03-01'),
      dueDate: new Date('2024-04-01'),
      status: 'PAID',
      projectCode: 'PRJ-001',
      isLinked: true,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-002' },
    update: {},
    create: {
      id: 'bill-002',
      billNumber: 'INV-2024-0102',
      supplierId: supplier2.id,
      projectId: project1.id,
      amount: 45000,
      billDate: new Date('2024-03-05'),
      dueDate: new Date('2024-04-05'),
      status: 'PAID',
      projectCode: 'PRJ-001',
      isLinked: true,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-003' },
    update: {},
    create: {
      id: 'bill-003',
      billNumber: 'INV-2024-0103',
      supplierId: supplier3.id,
      projectId: project1.id,
      amount: 32000,
      billDate: new Date('2024-03-08'),
      dueDate: new Date('2024-04-08'),
      status: 'PAID',
      projectCode: 'PRJ-001',
      isLinked: true,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-004' },
    update: {},
    create: {
      id: 'bill-004',
      billNumber: 'INV-2024-0201',
      supplierId: supplier4.id,
      projectId: project2.id,
      amount: 28000,
      billDate: new Date('2024-04-10'),
      dueDate: new Date('2024-05-10'),
      status: 'PAID',
      projectCode: 'PRJ-002',
      isLinked: true,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-005' },
    update: {},
    create: {
      id: 'bill-005',
      billNumber: 'INV-2024-0202',
      supplierId: supplier7.id,
      projectId: project2.id,
      amount: 18000,
      billDate: new Date('2024-04-12'),
      dueDate: new Date('2024-05-12'),
      status: 'PAID',
      projectCode: 'PRJ-002',
      isLinked: true,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-006' },
    update: {},
    create: {
      id: 'bill-006',
      billNumber: 'INV-2024-0301',
      supplierId: supplier1.id,
      projectId: project3.id,
      amount: 75000,
      billDate: new Date('2024-04-25'),
      dueDate: new Date('2024-05-25'),
      status: 'UNPAID',
      projectCode: 'PRJ-003',
      isLinked: true,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-007' },
    update: {},
    create: {
      id: 'bill-007',
      billNumber: 'INV-2024-0302',
      supplierId: supplier5.id,
      projectId: project3.id,
      amount: 22000,
      billDate: new Date('2024-04-28'),
      dueDate: new Date('2024-05-28'),
      status: 'UNPAID',
      projectCode: 'PRJ-003',
      isLinked: true,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-008' },
    update: {},
    create: {
      id: 'bill-008',
      billNumber: 'INV-2024-0303',
      supplierId: supplier6.id,
      projectId: project3.id,
      amount: 41000,
      billDate: new Date('2024-05-02'),
      dueDate: new Date('2024-06-02'),
      status: 'PARTIAL',
      projectCode: 'PRJ-003',
      isLinked: true,
    },
  })

  // Unlinked bills
  await prisma.bill.upsert({
    where: { id: 'bill-009' },
    update: {},
    create: {
      id: 'bill-009',
      billNumber: 'INV-2024-0401',
      supplierId: supplier2.id,
      projectId: null,
      amount: 55000,
      billDate: new Date('2024-05-15'),
      dueDate: new Date('2024-06-15'),
      status: 'UNPAID',
      projectCode: null,
      isLinked: false,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-010' },
    update: {},
    create: {
      id: 'bill-010',
      billNumber: 'INV-2024-0402',
      supplierId: supplier3.id,
      projectId: null,
      amount: 19500,
      billDate: new Date('2024-05-18'),
      dueDate: new Date('2024-06-18'),
      status: 'UNPAID',
      projectCode: null,
      isLinked: false,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-011' },
    update: {},
    create: {
      id: 'bill-011',
      billNumber: 'INV-2024-0403',
      supplierId: supplier8.id,
      projectId: null,
      amount: 8500,
      billDate: new Date('2024-05-20'),
      dueDate: new Date('2024-06-20'),
      status: 'UNPAID',
      projectCode: null,
      isLinked: false,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-012' },
    update: {},
    create: {
      id: 'bill-012',
      billNumber: 'INV-2024-0404',
      supplierId: supplier4.id,
      projectId: project4.id,
      amount: 38000,
      billDate: new Date('2024-05-22'),
      dueDate: new Date('2024-06-22'),
      status: 'UNPAID',
      projectCode: 'PRJ-004',
      isLinked: true,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-013' },
    update: {},
    create: {
      id: 'bill-013',
      billNumber: 'INV-2024-0501',
      supplierId: supplier1.id,
      projectId: project4.id,
      amount: 120000,
      billDate: new Date('2024-05-25'),
      dueDate: new Date('2024-06-25'),
      status: 'UNPAID',
      projectCode: 'PRJ-004',
      isLinked: true,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-014' },
    update: {},
    create: {
      id: 'bill-014',
      billNumber: 'INV-2024-0502',
      supplierId: supplier7.id,
      projectId: null,
      amount: 25000,
      billDate: new Date('2024-05-28'),
      dueDate: new Date('2024-06-28'),
      status: 'UNPAID',
      projectCode: null,
      isLinked: false,
    },
  })

  await prisma.bill.upsert({
    where: { id: 'bill-015' },
    update: {},
    create: {
      id: 'bill-015',
      billNumber: 'INV-2024-0503',
      supplierId: supplier6.id,
      projectId: project2.id,
      amount: 15000,
      billDate: new Date('2024-04-15'),
      dueDate: new Date('2024-05-15'),
      status: 'PAID',
      projectCode: 'PRJ-002',
      isLinked: true,
    },
  })

  console.log('تم إنشاء الفواتير')

  // Create issues
  await prisma.projectIssue.upsert({
    where: { id: 'issue-001' },
    update: {},
    create: {
      id: 'issue-001',
      projectId: project1.id,
      supplierId: supplier3.id,
      issueType: 'DELAY',
      impact: 'MEDIUM',
      notes: 'تأخر توريد معدات الإضاءة بيومين مما أثر على جدول التركيب',
      status: 'CLOSED',
    },
  })

  await prisma.projectIssue.upsert({
    where: { id: 'issue-002' },
    update: {},
    create: {
      id: 'issue-002',
      projectId: project2.id,
      supplierId: supplier8.id,
      issueType: 'DELAY',
      impact: 'MAJOR',
      notes: 'فشل ناقل البضاعة في الوصول في الموعد المحدد وتسبب في تأخر التركيب 4 ساعات',
      status: 'CLOSED',
    },
  })

  await prisma.projectIssue.upsert({
    where: { id: 'issue-003' },
    update: {},
    create: {
      id: 'issue-003',
      projectId: project3.id,
      supplierId: supplier5.id,
      issueType: 'QUALITY',
      impact: 'MEDIUM',
      notes: 'السجاد المورد لا يطابق المواصفات المتفق عليها من حيث اللون والجودة',
      status: 'OPEN',
    },
  })

  await prisma.projectIssue.upsert({
    where: { id: 'issue-004' },
    update: {},
    create: {
      id: 'issue-004',
      projectId: project3.id,
      supplierId: null,
      issueType: 'EXTRA_COST',
      impact: 'MINOR',
      notes: 'تكاليف إضافية غير مخططة لاستئجار معدات احتياطية',
      status: 'OPEN',
    },
  })

  await prisma.projectIssue.upsert({
    where: { id: 'issue-005' },
    update: {},
    create: {
      id: 'issue-005',
      projectId: project1.id,
      supplierId: supplier8.id,
      issueType: 'MATERIAL_SHORTAGE',
      impact: 'MINOR',
      notes: 'نقص في مواد التغليف الأمر الذي استدعى طلب توريد طارئ',
      status: 'CLOSED',
    },
  })

  console.log('تم إنشاء سجل المشاكل')

  // Create evaluations
  await prisma.supplierEvaluation.upsert({
    where: { id: 'eval-001' },
    update: {},
    create: {
      id: 'eval-001',
      projectId: project1.id,
      supplierId: supplier1.id,
      performance: 'EXCELLENT',
      repeatBusiness: true,
      notes: 'أداء ممتاز، التزام بالمواصفات والجدول الزمني',
    },
  })

  await prisma.supplierEvaluation.upsert({
    where: { id: 'eval-002' },
    update: {},
    create: {
      id: 'eval-002',
      projectId: project1.id,
      supplierId: supplier2.id,
      performance: 'GOOD',
      repeatBusiness: true,
      notes: 'جودة جيدة وتعاون ممتاز مع الفريق',
    },
  })

  await prisma.supplierEvaluation.upsert({
    where: { id: 'eval-003' },
    update: {},
    create: {
      id: 'eval-003',
      projectId: project2.id,
      supplierId: supplier8.id,
      performance: 'POOR',
      repeatBusiness: false,
      notes: 'تأخر كبير في التسليم وعدم الالتزام بالمواعيد، لا يُنصح بالتعامل مجدداً',
    },
  })

  await prisma.supplierEvaluation.upsert({
    where: { id: 'eval-004' },
    update: {},
    create: {
      id: 'eval-004',
      projectId: project2.id,
      supplierId: supplier7.id,
      performance: 'EXCELLENT',
      repeatBusiness: true,
      notes: 'تصوير احترافي رائع، نتائج تجاوزت التوقعات',
    },
  })

  console.log('تم إنشاء التقييمات')

  // Create settings
  await prisma.setting.upsert({
    where: { key: 'LOW_PROFIT_THRESHOLD' },
    update: {},
    create: {
      key: 'LOW_PROFIT_THRESHOLD',
      value: '20',
    },
  })

  await prisma.setting.upsert({
    where: { key: 'ZOHO_ACCESS_TOKEN' },
    update: {},
    create: {
      key: 'ZOHO_ACCESS_TOKEN',
      value: '',
    },
  })

  await prisma.setting.upsert({
    where: { key: 'ZOHO_TOKEN_EXPIRES_AT' },
    update: {},
    create: {
      key: 'ZOHO_TOKEN_EXPIRES_AT',
      value: '0',
    },
  })

  await prisma.setting.upsert({
    where: { key: 'LAST_SYNC_AT' },
    update: {},
    create: {
      key: 'LAST_SYNC_AT',
      value: '',
    },
  })

  await prisma.setting.upsert({
    where: { key: 'PROJECT_CODE_SOURCE' },
    update: {},
    create: {
      key: 'PROJECT_CODE_SOURCE',
      value: 'custom_field',
    },
  })

  console.log('تم إنشاء الإعدادات')
  console.log('✓ تم إدخال جميع البيانات التجريبية بنجاح')
  console.log('  البريد الإلكتروني للمدير: admin@sahab.ae | كلمة المرور: Admin@123')
  console.log('  البريد الإلكتروني للعمليات: ops@sahab.ae | كلمة المرور: Ops@123')
}

main()
  .catch((e) => {
    console.error('خطأ في إدخال البيانات:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
