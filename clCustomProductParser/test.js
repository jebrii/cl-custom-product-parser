let foo = '';
let bar = '';

const changeString = (stringToChange, val) => {
  stringToChange = val;
}

changeString(foo, 'this');
changeString(bar, 'that');

console.log(foo);
console.log(bar);
