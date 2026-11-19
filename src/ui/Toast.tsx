import { useEffect, useState } from 'preact/hooks';

export function Toast() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      clearTimeout(t);
      t = setTimeout(() => setText(null), 2600);
    };
    addEventListener('se:toast', on);
    return () => removeEventListener('se:toast', on);
  }, []);
  return text ? <div class="toast" role="status">{text}</div> : null;
}
