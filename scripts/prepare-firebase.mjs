import { cp, mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
const pkg = JSON.parse(await readFile('package.json','utf8'));
await mkdir('.firebase-app', {recursive:true});
await cp('dist/server', '.firebase-app/dist/server', {recursive:true});
await cp('firebase/index.mjs', '.firebase-app/index.mjs');
await cp('firebase/request.mjs', '.firebase-app/request.mjs');
const names = ['@astrojs/node','astro','firebase-admin','firebase-functions','iron-session'];
const dependencies = Object.fromEntries(names.map(name => [name, pkg.dependencies[name]]));
await writeFile('.firebase-app/package.json', JSON.stringify({name:'family-allowance-server',private:true,type:'module',main:'index.mjs',engines:{node:'22'},dependencies,overrides:pkg.overrides},null,2)+'\n');
console.log('Prepared Firebase Functions server bundle.');

// External drives on macOS can create AppleDouble files; never publish them.
async function removeAppleDouble(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const path = `${dir}/${entry.name}`;
    if (entry.name.startsWith('._')) await unlink(path).catch(error => {if (error.code !== 'ENOENT') throw error;});
    else if (entry.isDirectory()) await removeAppleDouble(path);
  }
}
await removeAppleDouble('.firebase-app/dist');
await removeAppleDouble('dist/client');
