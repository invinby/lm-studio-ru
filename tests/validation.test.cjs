const {test}=require('node:test');const assert=require('node:assert/strict');
let validate;try{({validate}=require('../lib/validate.cjs'))}catch{}
test('accepts nested and dotted keys without changing variables or tags',()=>{assert.deepEqual(validate({a:{b:'Hello {{name}} <link>x</link>'}},{a:{b:'Привет, {{name}} <link>текст</link>'}}).errors,[])});
test('rejects missing keys and changed interpolation variables',()=>{assert.equal(validate({a:'{{name}}',b:'Missing'},{a:'{{other}}'}).errors.length,2)});
test('rejects lost markup, empty translation and incorrect type',()=>{assert.equal(validate({a:'<link>More</link>',b:'Hi',c:'String'},{a:'Подробнее',b:' ',c:{}}).errors.length,3)});
test('treats Empty as literal UI text',()=>{assert.deepEqual(validate({a:'<Empty>'},{a:'<Пусто>'}).errors,[])});
test('permits intentionally empty English plural-zero labels',()=>{assert.deepEqual(validate({a:''},{a:''}).errors,[])});
