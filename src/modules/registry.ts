import type { ToolDef } from '../calc/types';
import { audioTools } from '../calc/audio';
import { assistTools } from '../calc/assist';

export type ModuleStatus = 'ready' | 'part' | 'next' | 'planned';

export interface ModuleDef {
  code: string;
  title: string;
  desc: string;
  status: ModuleStatus;
  /** Готовые инструменты. */
  tools: ToolDef[];
  /** Что появится в модуле (для ещё не готовых). */
  planned: string[];
  /** Отдельные экраны модуля (не калькуляторы). */
  screens?: { id: string; title: string; short: string }[];
}

export const MODULES: ModuleDef[] = [
  {
    code: 'A', title: 'Audio Calculator', desc: 'акустика, сабы, усилители, кабели, SPL', status: 'ready', tools: audioTools,
    planned: [],
    screens: [{ id: 'gear', title: 'База акустики', short: 'RCF HDL 20-A, SUB 8006-AS, ART 912-A/915-A и свои модели' }],
  },
  {
    code: 'B', title: 'Схемы коммутации', desc: 'схема, Patch List, список кабелей', status: 'ready', tools: [],
    planned: [],
    screens: [{ id: 'wiring', title: 'Генератор схем коммутации', short: 'Patch List, выходы, кабели, схема' }],
  },
  {
    code: 'C', title: 'Помощник звукорежиссёра', desc: 'патчинг, маршрутизация, тренажёр Qu-16/24, диагностика', status: 'ready', tools: assistTools,
    planned: ['Разбор фото разъёмов и панелей через ИИ-сервис по вашему ключу'],
    screens: [
      { id: 'patch', title: 'Патчинг входов и выходов', short: 'Input / Output Patch, стейджбокс, проверка ошибок' },
      { id: 'routing', title: 'Маршрутизация и путь сигнала', short: 'LR, AUX, FX, группы, Matrix, PAFL, Direct Out' },
      { id: 'builder', title: 'Конструктор коммутации', short: 'соединить блоки кабелями и проверить' },
      { id: 'trainer', title: 'Тренажёр Qu-16 / Qu-24', short: 'органы управления, уроки, викторина' },
      { id: 'tasks', title: 'Практические задания', short: 'конференция, 8 микрофонов, мониторы, поиск ошибок' },
      { id: 'diag', title: 'Диагностика', short: 'нет сигнала, шум, гул, перегрузка, заводка' },
      { id: 'tone', title: 'Настройка звука', short: 'Gain, HPF, EQ, Gate, компрессор, FX' },
      { id: 'connectors', title: 'Разъёмы и панели', short: 'справочник с рисунками, сравнение с фото' },
    ],
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
