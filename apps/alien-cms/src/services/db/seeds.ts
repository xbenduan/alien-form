import dayjs from 'dayjs';
import type { ModelRecord } from '../../domains/record/types/record';

const statuses = ['draft', 'review', 'published', 'archived'] as const;
const serviceSlots = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
] as const;

const employees = [
  {
    id: 'employee-1',
    employeeName: 'Luna',
    age: 28,
    level: 'senior',
    hourlyRate: 260,
    skills: ['延长建构', '节日手绘', '高客单'],
    serviceIds: ['service-1', 'service-3', 'service-4'],
    serviceSlots: ['10:00', '11:00', '14:00', '15:00', '18:00'],
    editablePermissions: [
      { record: 'nail-booking', fieldKeys: ['status', 'preferenceNotes', 'depositPaid'] },
      { record: 'nail-service', fieldKeys: ['price', 'styleDescription'] },
    ],
    notes: '负责高客单预约和复杂款式复购客户。',
  },
  {
    id: 'employee-2',
    employeeName: 'Momo',
    age: 24,
    level: 'middle',
    hourlyRate: 190,
    skills: ['猫眼渐变', '纯色快单', '手部护理'],
    serviceIds: ['service-1', 'service-2'],
    serviceSlots: ['08:00', '09:00', '12:00', '13:00', '16:00', '17:00'],
    editablePermissions: [
      { record: 'nail-booking', fieldKeys: ['bookingDate', 'serviceSlot', 'preferenceNotes'] },
    ],
    notes: '擅长午间快单和工作日高频预约。',
  },
  {
    id: 'employee-3',
    employeeName: 'Kiki',
    age: 31,
    level: 'senior',
    hourlyRate: 280,
    skills: ['法式延长', '婚礼定制', '低饱和设计'],
    serviceIds: ['service-2', 'service-3', 'service-4'],
    serviceSlots: ['09:00', '10:00', '13:00', '16:00', '19:00', '20:00'],
    editablePermissions: [
      { record: 'nail-employee', fieldKeys: ['serviceSlots', 'serviceIds'] },
      { record: 'nail-booking', fieldKeys: ['status', 'serviceSlot'] },
    ],
    notes: '主要承接婚礼档期和节假日定制预约。',
  },
  {
    id: 'employee-4',
    employeeName: 'Nora',
    age: 22,
    level: 'junior',
    hourlyRate: 150,
    skills: ['基础护理', '卸甲修型', '手部保养'],
    serviceIds: ['service-1'],
    serviceSlots: ['08:00', '11:00', '12:00', '15:00', '17:00'],
    editablePermissions: [
      { record: 'nail-booking', fieldKeys: ['bookingDate', 'serviceId'] },
    ],
    notes: '负责基础护理和新客体验单。',
  },
] as const;

const services = [
  {
    id: 'service-1',
    serviceName: '日常纯色护理',
    category: 'care',
    durationMinutes: 60,
    price: 168,
    difficulty: 'standard',
    styleDescription: '以纯色和基础修型为主，适合日常通勤和短时段预约。',
    styleTags: ['通勤', '显手白', '高复购'],
    employeeIds: ['employee-1', 'employee-2', 'employee-4'],
    scenes: ['工作日快单', '新客体验'],
    notes: '支持加购卸甲和基础手护。',
  },
  {
    id: 'service-2',
    serviceName: '猫眼渐变设计',
    category: 'design',
    durationMinutes: 90,
    price: 238,
    difficulty: 'advanced',
    styleDescription: '猫眼、跳色和低饱和渐变结合，适合社交聚会和轻设计需求。',
    styleTags: ['猫眼', '低饱和', '拍照好看'],
    employeeIds: ['employee-2', 'employee-3'],
    scenes: ['约会', '聚会'],
    notes: '建议提前确认主色和跳色组合。',
  },
  {
    id: 'service-3',
    serviceName: '法式延长套餐',
    category: 'extension',
    durationMinutes: 120,
    price: 328,
    difficulty: 'advanced',
    styleDescription: '提供法式延长和基础建构，适合长甲和宴会型造型需求。',
    styleTags: ['法式', '长甲', '建构'],
    employeeIds: ['employee-1', 'employee-3'],
    scenes: ['宴会', '写真'],
    notes: '到店前需确认手型和延长长度偏好。',
  },
  {
    id: 'service-4',
    serviceName: '节日定制礼盒款',
    category: 'festival',
    durationMinutes: 150,
    price: 428,
    difficulty: 'custom',
    styleDescription: '结合节庆主题、手绘和立体装饰的高定款式，适合强主题预约。',
    styleTags: ['节日', '高定', '手绘'],
    employeeIds: ['employee-1', 'employee-3'],
    scenes: ['节假日', '婚礼'],
    notes: '建议至少提前两天锁定档期和设计图。',
  },
] as const;

const bookingSeeds = [
  {
    customerName: '林晚',
    serviceId: 'service-1',
    employeeId: 'employee-2',
    serviceSlot: '12:00',
    status: 'draft',
    depositPaid: false,
    styleTags: ['通勤', '裸粉', '短甲'],
    preferenceNotes: '希望一个小时内完成，优先选显手白纯色。',
  },
  {
    customerName: '周周',
    serviceId: 'service-2',
    employeeId: 'employee-3',
    serviceSlot: '13:00',
    status: 'review',
    depositPaid: true,
    styleTags: ['猫眼', '低饱和', '约会'],
    preferenceNotes: '已发参考图，想保留一点跳色层次。',
  },
  {
    customerName: '陈雨',
    serviceId: 'service-3',
    employeeId: 'employee-1',
    serviceSlot: '14:00',
    status: 'published',
    depositPaid: true,
    styleTags: ['法式', '延长', '宴会'],
    preferenceNotes: '周末参加宴会，需要偏成熟的法式延长款。',
  },
  {
    customerName: 'Mia',
    serviceId: 'service-4',
    employeeId: 'employee-3',
    serviceSlot: '19:00',
    status: 'archived',
    depositPaid: true,
    styleTags: ['节日', '手绘', '闪片'],
    preferenceNotes: '上次做的是圣诞礼盒款，这次想换成生日主题。',
  },
  {
    customerName: 'Kiki',
    serviceId: 'service-1',
    employeeId: 'employee-4',
    serviceSlot: '11:00',
    status: 'review',
    depositPaid: false,
    styleTags: ['基础护理', '修型'],
    preferenceNotes: '新客首次到店，先做基础护理和卸甲修型。',
  },
  {
    customerName: '阿宁',
    serviceId: 'service-2',
    employeeId: 'employee-2',
    serviceSlot: '16:00',
    status: 'draft',
    depositPaid: false,
    styleTags: ['猫眼', '工作日', '显白'],
    preferenceNotes: '希望下班前完成，颜色尽量低调但有层次。',
  },
  {
    customerName: 'Yoyo',
    serviceId: 'service-3',
    employeeId: 'employee-3',
    serviceSlot: '20:00',
    status: 'review',
    depositPaid: true,
    styleTags: ['长甲', '写真', '法式'],
    preferenceNotes: '要配合写真拍摄，需要偏冷调法式线条。',
  },
  {
    customerName: '苏苏',
    serviceId: 'service-4',
    employeeId: 'employee-1',
    serviceSlot: '18:00',
    status: 'published',
    depositPaid: true,
    styleTags: ['高定', '婚礼', '珍珠'],
    preferenceNotes: '婚礼试妆同步预约，希望先看两版主题方案。',
  },
] as const;

export function createNailEmployeeSeeds(): ModelRecord[] {
  return employees.map((employee, index) => {
    const createdAt = dayjs().subtract(20 - index * 2, 'day').hour(10).minute(0).second(0);
    const updatedAt = createdAt.add(index + 2, 'day').add(index * 11, 'minute');

    return {
      ...employee,
      hiredAt: createdAt.subtract(120 + index * 60, 'day').format('YYYY-MM-DD'),
      active: true,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    } satisfies ModelRecord;
  });
}

export function createNailServiceSeeds(): ModelRecord[] {
  return services.map((service, index) => {
    const createdAt = dayjs().subtract(14 - index, 'day').hour(11).minute(20).second(0);
    const updatedAt = createdAt.add(index + 1, 'day').add(index * 13, 'minute');

    return {
      ...service,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    } satisfies ModelRecord;
  });
}

export function createNailBookingSeeds(): ModelRecord[] {
  return bookingSeeds.map((booking, index) => {
    const createdAt = dayjs().subtract(8 - index, 'day').hour(12 + (index % 3)).minute(15).second(0);
    const updatedAt = createdAt.add((index % 2) + 1, 'day').add(index * 7, 'minute');
    const slotIndex = serviceSlots.findIndex((slot) => slot === booking.serviceSlot);
    const bookingDate = createdAt.add((slotIndex % 4) + 1, 'day').format('YYYY-MM-DD');

    return {
      id: `nail-booking-${index + 1}`,
      ...booking,
      phone: `1380000${String(200 + index)}`,
      bookingDate,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    } satisfies ModelRecord;
  });
}
