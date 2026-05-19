import { signal, effect } from './node_modules/alien-signals/esm/index.js';
const version = signal(0);
let renders = 0;
effect(() => {
  version();
  renders++;
  console.log("effect run, renders:", renders);
});
console.log("updating version");
version(version() + 1);
console.log("updated version");
