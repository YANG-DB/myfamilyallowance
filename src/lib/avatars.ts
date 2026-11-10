export const avatars = [
  {id:'fox', name:'Clever Fox', character:'🦊', color:'#ffe0bc'},
  {id:'robot', name:'Space Robot', character:'🤖', color:'#bde8ef'},
  {id:'panda', name:'Chill Panda', character:'🐼', color:'#dbe9d4'},
  {id:'unicorn', name:'Magic Unicorn', character:'🦄', color:'#f1d4f4'},
  {id:'dinosaur', name:'Dino Explorer', character:'🦖', color:'#cee9af'},
  {id:'cat', name:'Curious Cat', character:'🐱', color:'#ffe6a1'},
  {id:'astronaut', name:'Star Explorer', character:'🧑‍🚀', color:'#d4dbff'},
  {id:'penguin', name:'Cool Penguin', character:'🐧', color:'#c5e3f6'},
  {id:'frog', name:'Happy Frog', character:'🐸', color:'#d0efc4'},
  {id:'lion', name:'Brave Lion', character:'🦁', color:'#ffd8ac'},
  {id:'octopus', name:'Ocean Buddy', character:'🐙', color:'#f7cde0'},
  {id:'bear', name:'Cozy Bear', character:'🐻', color:'#e9d6c7'},
] as const;
export function getAvatar(id?: string | null) { return avatars.find(avatar => avatar.id === id) ?? avatars[0]; }
export function isAvatarId(value: string) { return avatars.some(avatar => avatar.id === value); }
