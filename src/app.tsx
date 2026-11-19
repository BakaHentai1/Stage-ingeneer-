import { useRoute } from './core/router';
import { useCurrentProject } from './core/state';
import { Home } from './screens/Home';
import { ModuleScreen, NotFound } from './screens/ModuleScreen';
import { ToolScreen } from './screens/ToolScreen';
import { ProjectDetail, Projects } from './screens/Projects';
import { Settings } from './screens/Settings';
import { WiringScreen } from './screens/Wiring';
import { Toast } from './ui/Toast';
import { IconBox, IconFolder, IconGear, IconHome } from './ui/icons';

function View({ r }: { r: string[] }) {
  if (r.length === 0) return <Home />;
  if (r[0] === 'm' && r[1] && !r[2]) return <ModuleScreen code={r[1]} />;
  if (r[0] === 'm' && r[1] === 'b' && r[2] === 'wiring') return <WiringScreen />;
  if (r[0] === 'm' && r[1] && r[2]) return <ToolScreen code={r[1]} toolId={r[2]} />;
  if (r[0] === 'projects' && !r[1]) return <Projects />;
  if (r[0] === 'projects' && r[1]) return <ProjectDetail id={r[1]} />;
  if (r[0] === 'inventory') return <ModuleScreen code="d" />;
  if (r[0] === 'settings') return <Settings />;
  return <NotFound />;
}

export function App() {
  const r = useRoute();
  const [project] = useCurrentProject();
  const tab = r[0] === 'projects' ? 'proj' : r[0] === 'inventory' ? 'inv' : r[0] === 'settings' ? 'set' : 'home';
  return (
    <div class="app">
      <header class="appbar no-print">
        <a class="brand" href="#/">STAGE ENGINEER<small>система техника сцены</small></a>
        {project ? <a class="cur" href={`#/projects/${project.id}`} title="Текущий проект">{project.name}</a> : null}
      </header>
      <header class="print-only print-head">STAGE ENGINEER · {new Date().toLocaleDateString('ru-RU')}</header>
      <main>
        <View r={r} />
      </main>
      <nav class="tabbar no-print" aria-label="Навигация">
        <a class={`tab ${tab === 'home' ? 'on' : ''}`} href="#/"><IconHome />Главная</a>
        <a class={`tab ${tab === 'proj' ? 'on' : ''}`} href="#/projects"><IconFolder />Проекты</a>
        <a class={`tab ${tab === 'inv' ? 'on' : ''}`} href="#/inventory"><IconBox />Склад</a>
        <a class={`tab ${tab === 'set' ? 'on' : ''}`} href="#/settings"><IconGear />Настройки</a>
      </nav>
      <Toast />
    </div>
  );
}
