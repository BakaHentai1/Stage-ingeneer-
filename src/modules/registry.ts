import type { ToolDef } from '../calc/types';
import { audioTools } from '../calc/audio';

export type ModuleStatus = 'ready' | 'next' | 'planned';

export interface ModuleDef {
  code: string;
  title: string;
  desc: string;
  status: ModuleStatus;
  /** Готовые инструменты. */
  tools: ToolDef[];
  /** Что появится в модуле (для ещё не готовых). */
  planned: string[];
}

export const MODULES: ModuleDef[] = [
  {
    code: 'A', title: 'Audio Calculator', desc: 'акустика, сабы, усилители, кабели, SPL', status: 'ready', tools: audioTools,
    planned: [],
  },
  {
    code: 'B', title: 'Схемы коммутации', desc: 'схема, Patch List, список кабелей', status: 'next', tools: [],
    planned: ['Пульт и стейджбокс', 'XLR, Jack TRS, RCA, UTP', 'Активная и пассивная акустика, усилители', 'Мониторы, сабвуферы, микрофоны', 'Визуальная схема подключения', 'Patch List и список кабелей с экспортом'],
  },
  {
    code: 'C', title: 'Помощник звукорежиссёра', desc: 'Gain, EQ, динамика, фидбэк', status: 'planned', tools: [],
    planned: ['Gain staging для Qu-16, Qu-24 и аналоговых пультов', 'EQ, HPF, LPF по источникам', 'Компрессор и Gate', 'Поиск причин фонового шума', 'Диагностика обратной связи', 'Мониторные линии и маршрутизация'],
  },
  {
    code: 'D', title: 'Склад техники', desc: 'учёт, комплекты, выдача', status: 'planned', tools: [],
    planned: ['Каталог: модель, категория, серийный номер, состояние, место', 'Комплектация и неисправности', 'Комплекты под мероприятие', 'Выдача и возврат', 'Ведомости в CSV и PDF'],
  },
  {
    code: 'E', title: 'LED-экраны', desc: 'кабинеты, разрешение, питание', status: 'planned', tools: [],
    planned: ['Размер экрана и кабинетов', 'Pixel pitch и итоговое разрешение', 'Нагрузка на процессор', 'Схема соединения кабинетов', 'Распределение питания'],
  },
  {
    code: 'F', title: 'Свет и DMX', desc: 'адресация, Universe, питание', status: 'planned', tools: [],
    planned: ['DMX-адресация', 'Распределение по Universe', 'Patch List', 'Схемы подключения DMX', 'Распределение питания'],
  },
  {
    code: 'G', title: 'Подготовка мероприятия', desc: 'площадка, сцена, оборудование, монтаж, чек-лист', status: 'planned', tools: [],
    planned: ['Размер площадки и схема сцены', 'Список оборудования из модулей A–F', 'Кабели', 'Список монтажных работ', 'Чек-лист перед мероприятием'],
  },
];

export function findModule(code: string): ModuleDef | undefined {
  return MODULES.find((m) => m.code.toLowerCase() === code.toLowerCase());
}

export function findTool(moduleCode: string, toolId: string): ToolDef | undefined {
  return findModule(moduleCode)?.tools.find((t) => t.id === toolId);
}
