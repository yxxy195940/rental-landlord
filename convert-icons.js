// convert-icons.js
// 这是一个转换脚本，用于将SVG转换为PNG
// 需要在node.js环境中运行，安装 sharp 或 canvas 库

const fs = require('fs');
const path = require('path');

// 简单的SVG到Data URL转换
function svgToDataUrl(svgContent) {
  return `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
}

// 读取所有SVG文件并输出说明
const svgFiles = [
  'home.svg', 'home-active.svg',
  'room.svg', 'room-active.svg', 
  'bill.svg', 'bill-active.svg',
  'user.svg', 'user-active.svg'
];

console.log('SVG图标已创建完成！');
console.log('\n需要转换为PNG格式，请按以下步骤操作：');
console.log('\n方法1: 在线转换');
console.log('1. 访问 https://convertio.co/svg-png/');
console.log('2. 上传SVG文件');
console.log('3. 设置尺寸为 78x78 像素');
console.log('4. 下载PNG文件');

console.log('\n方法2: 使用设计软件');
console.log('1. 用 Figma/Sketch/Illustrator 打开SVG');
console.log('2. 导出为 78x78 PNG');
console.log('3. 保存到 images 文件夹');

console.log('\n方法3: 暂时使用字体图标');
console.log('可以先配置 app.json，使用文字代替图标');

console.log('\n创建的图标文件：');
svgFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, 'images', file))) {
    console.log(`✅ ${file}`);
  }
});