import type { Category } from '../docparse/catalog';

const P = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

/** Значок категории оборудования — показывается, пока к позиции не прикреплено фото. */
export function CatIcon({ cat }: { cat: Category }) {
  switch (cat) {
    case 'Звук': // колонка
      return (<svg viewBox="0 0 24 24" {...P}><rect x="6" y="2.5" width="12" height="19" rx="1.5" /><circle cx="12" cy="15" r="3.5" /><circle cx="12" cy="7" r="1.8" /></svg>);
    case 'Микрофоны':
      return (<svg viewBox="0 0 24 24" {...P}><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4.5M8.5 21.5h7" /></svg>);
    case 'Пульты': // фейдеры
      return (<svg viewBox="0 0 24 24" {...P}><rect x="2.5" y="4" width="19" height="16" rx="1.5" /><path d="M7 7v10M12 7v10M17 7v10" /><path d="M5.5 13h3M10.5 9h3M15.5 15h3" /></svg>);
    case 'Свет': // прибор на лире
      return (<svg viewBox="0 0 24 24" {...P}><path d="M5 20h14M12 20v-3" /><path d="M6 6v7h12V6" /><rect x="8" y="3" width="8" height="10" rx="2" /><path d="M10 8h4" /></svg>);
    case 'Экраны': // LED-кабинеты
      return (<svg viewBox="0 0 24 24" {...P}><rect x="2.5" y="4" width="19" height="13" rx="1" /><path d="M2.5 10.5h19M9 4v13M15 4v13M8 21h8M12 17v4" /></svg>);
    case 'Видео': // монитор
      return (<svg viewBox="0 0 24 24" {...P}><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M9 20h6M12 16v4" /></svg>);
    case 'Конференц': // наушники
      return (<svg viewBox="0 0 24 24" {...P}><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4" height="6" rx="1.2" /><rect x="17" y="14" width="4" height="6" rx="1.2" /></svg>);
    case 'Конструкции': // ферма
      return (<svg viewBox="0 0 24 24" {...P}><path d="M2.5 8h19M2.5 16h19M2.5 8l4 8 4-8 3 8 4-8 4 8" /></svg>);
    case 'Сцена': // подиум
      return (<svg viewBox="0 0 24 24" {...P}><path d="M2.5 10h19v3h-19z" /><path d="M4.5 13v7M19.5 13v7M12 13v7" /></svg>);
    case 'Питание': // вилка
      return (<svg viewBox="0 0 24 24" {...P}><path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0zM12 16.5V21" /></svg>);
    case 'Коммутация': // кабель
      return (<svg viewBox="0 0 24 24" {...P}><path d="M4 7h4v4H4zM16 13h4v4h-4zM8 9c6 0 2 6 8 6" /></svg>);
    case 'Мебель':
      return (<svg viewBox="0 0 24 24" {...P}><path d="M6 11V5h12v6M4 11h16v4H4zM6 15v5M18 15v5" /></svg>);
    default: // кейс
      return (<svg viewBox="0 0 24 24" {...P}><rect x="3" y="7" width="18" height="13" rx="1.5" /><path d="M9 7V4.5h6V7M3 12h18M11 12v2h2v-2" /></svg>);
  }
}
