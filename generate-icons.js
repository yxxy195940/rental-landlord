const fs = require('fs');

// 使用Canvas来创建简洁的PNG图标
// 这里先创建SVG内容，然后提供转换方案

const iconConfigs = [
  {
    name: 'home',
    paths: [
      'M20 30L40 15L60 30V55C60 57 58 59 56 59H24C22 59 20 57 20 55V30Z',
      'M30 59V40H50V59'
    ],
    color: '#666666'
  },
  {
    name: 'home-active',
    paths: [
      'M20 30L40 15L60 30V55C60 57 58 59 56 59H24C22 59 20 57 20 55V30Z',
      'M30 59V40H50V59'
    ],
    color: '#1989fa'
  },
  {
    name: 'room',
    paths: [
      'M15 25H65V65H15Z',
      'M25 15H55V55H25Z'
    ],
    extras: [
      '<circle cx="58" cy="40" r="2" fill="COLOR"/>',
      '<line x1="30" y1="30" x2="50" y2="30" stroke="COLOR" stroke-width="2"/>',
      '<line x1="30" y1="37" x2="45" y2="37" stroke="COLOR" stroke-width="2"/>'
    ],
    color: '#666666'
  },
  {
    name: 'room-active',
    paths: [
      'M15 25H65V65H15Z',
      'M25 15H55V55H25Z'
    ],
    extras: [
      '<circle cx="58" cy="40" r="2" fill="COLOR"/>',
      '<line x1="30" y1="30" x2="50" y2="30" stroke="COLOR" stroke-width="2"/>',
      '<line x1="30" y1="37" x2="45" y2="37" stroke="COLOR" stroke-width="2"/>'
    ],
    color: '#1989fa'
  },
  {
    name: 'bill',
    paths: [
      'M25 12H55V68H25Z'
    ],
    extras: [
      '<line x1="30" y1="25" x2="50" y2="25" stroke="COLOR" stroke-width="2"/>',
      '<line x1="30" y1="32" x2="50" y2="32" stroke="COLOR" stroke-width="2"/>',
      '<line x1="30" y1="39" x2="45" y2="39" stroke="COLOR" stroke-width="2"/>',
      '<circle cx="60" cy="25" r="6" stroke="COLOR" stroke-width="2" fill="none"/>',
      '<polyline points="57,25 59,27 63,23" stroke="COLOR" stroke-width="2" fill="none"/>'
    ],
    color: '#666666'
  },
  {
    name: 'bill-active',
    paths: [
      'M25 12H55V68H25Z'
    ],
    extras: [
      '<line x1="30" y1="25" x2="50" y2="25" stroke="COLOR" stroke-width="2"/>',
      '<line x1="30" y1="32" x2="50" y2="32" stroke="COLOR" stroke-width="2"/>',
      '<line x1="30" y1="39" x2="45" y2="39" stroke="COLOR" stroke-width="2"/>',
      '<circle cx="60" cy="25" r="6" stroke="COLOR" stroke-width="2" fill="COLOR" fill-opacity="0.2"/>',
      '<polyline points="57,25 59,27 63,23" stroke="COLOR" stroke-width="2" fill="none"/>'
    ],
    color: '#1989fa'
  },
  {
    name: 'user',
    paths: [],
    extras: [
      '<circle cx="40" cy="25" r="8" stroke="COLOR" stroke-width="3" fill="none"/>',
      '<path d="M20 55C20 45 29 37 40 37C51 37 60 45 60 55" stroke="COLOR" stroke-width="3" fill="none"/>'
    ],
    color: '#666666'
  },
  {
    name: 'user-active',
    paths: [],
    extras: [
      '<circle cx="40" cy="25" r="8" stroke="COLOR" stroke-width="3" fill="COLOR" fill-opacity="0.1"/>',
      '<path d="M20 55C20 45 29 37 40 37C51 37 60 45 60 55" stroke="COLOR" stroke-width="3" fill="none"/>'
    ],
    color: '#1989fa'
  }
];

// 生成SVG内容
function generateSVG(config) {
  let svg = `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">`;
  
  // 添加路径
  config.paths.forEach(path => {
    svg += `<path d="${path}" stroke="${config.color}" stroke-width="3" fill="none" stroke-linejoin="round"/>`;
  });
  
  // 添加额外元素
  if (config.extras) {
    config.extras.forEach(extra => {
      svg += extra.replace(/COLOR/g, config.color);
    });
  }
  
  svg += `</svg>`;
  return svg;
}

// 创建所有图标
iconConfigs.forEach(config => {
  const svgContent = generateSVG(config);
  fs.writeFileSync(`images/${config.name}.svg`, svgContent);
  console.log(`✅ 创建 ${config.name}.svg`);
});

console.log('\n🎨 简洁线条图标创建完成！');
console.log('\n📱 图标特点：');
console.log('- 简洁的线条设计');
console.log('- 未选中：灰色 (#666666)');
console.log('- 选中：蓝色 (#1989fa) + 轻微填充');
console.log('- 尺寸：80x80 像素');

console.log('\n🔄 转换为PNG步骤：');
console.log('1. 访问 https://svgtopng.com/');
console.log('2. 上传SVG文件');
console.log('3. 设置宽度和高度为 78');
console.log('4. 下载PNG文件');
console.log('5. 替换images文件夹中的SVG文件');

console.log('\n🚀 或者运行转换命令：');
console.log('npm install sharp');
console.log('node convert-svg-to-png.js');