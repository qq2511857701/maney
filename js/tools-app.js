/**

 * 小工具页：免费第三方在线工具（按分类展示）

 */



const TOOLS = [

  // ── 图片处理 ──

  {

    category: '图片处理',

    name: '改尺寸 / 转格式',

    desc: '调整分辨率、裁剪、压缩，JPG / PNG / WebP 等格式互转',

    site: '改图宝',

    url: 'https://www.gaitubao.com/#set-resize-size',

    icon: '📐',

  },

  {

    category: '图片处理',

    name: '修改图片尺寸',

    desc: '按像素或比例缩放，支持批量改宽高，适合电商主图规格',

    site: '做好图',

    url: 'http://www.zuohaotu.com/modify-image-size.aspx',

    icon: '↔️',

  },

  {

    category: '图片处理',

    name: '批量改图 / 压缩',

    desc: '免费批量压缩、改尺寸、裁剪、转格式，一次处理多张',

    site: 'iLoveIMG',

    url: 'https://www.iloveimg.com/zh-cn',

    icon: '📦',

  },

  {

    category: '图片处理',

    name: '消除背景 / 扣白底',

    desc: 'AI 一键去背景，适合产品图、证件照白底图',

    site: 'remove.bg',

    url: 'https://www.remove.bg/zh/upload',

    icon: '✂️',

  },

  {

    category: '图片处理',

    name: 'WebP 转 JPG',

    desc: 'WebP 转 JPG/PNG，豆包等 AI 图常见格式互转',

    site: 'CDKM',

    url: 'https://cdkm.com/cn/webp-to-jpg',

    icon: '🔄',

  },

  {

    category: '图片处理',

    name: '图片压缩',

    desc: 'PNG / JPG 智能压缩，体积更小、画质损失小',

    site: 'TinyPNG',

    url: 'https://tinypng.com/',

    icon: '🗜️',

  },

  {

    category: '图片处理',

    name: '浏览器本地压缩',

    desc: 'Google 出品，压缩/裁剪/转格式，图片不上传服务器',

    site: 'Squoosh',

    url: 'https://squoosh.app/',

    icon: '🖼️',

  },

  {

    category: '图片处理',

    name: '图片 OCR 转文字',

    desc: '截图/照片识别成文字，可用来抄验光单、订单信息',

    site: '白描网页版',

    url: 'https://web.baimiaoapp.com/',

    icon: '🔤',

  },



  // ── PDF / 文档 ──

  {

    category: 'PDF / 文档',

    name: 'PDF 转 Word',

    desc: 'PDF 转可编辑 Word，保留排版，适合改报价单、说明书',

    site: 'Smallpdf',

    url: 'https://smallpdf.com/cn/pdf-to-word#r=convert-to-word',

    icon: '📄',

  },

  {

    category: 'PDF / 文档',

    name: 'PDF 全能工具箱',

    desc: '合并、拆分、压缩、转 Word/Excel/PPT、OCR 等',

    site: 'HiPDF',

    url: 'https://www.hipdf.cn/all-tools',

    icon: '📑',

  },

  {

    category: 'PDF / 文档',

    name: 'PDF 合并 / 拆分',

    desc: '免费合并多个 PDF、拆分页面、压缩体积',

    site: 'iLovePDF',

    url: 'https://www.ilovepdf.com/zh-cn',

    icon: '📎',

  },

  {

    category: 'PDF / 文档',

    name: 'PDF 免费工具集',

    desc: '完全免费，合并/拆分/压缩/转图片/JPG 转 PDF 等',

    site: 'PDF24',

    url: 'https://tools.pdf24.org/zh/',

    icon: '🆓',

  },



  // ── 格式转换 ──

  {

    category: '格式转换',

    name: '万能格式转换',

    desc: '文档、图片、音视频等上百种格式互转',

    site: 'Alltoall',

    url: 'https://www.alltoall.net/',

    icon: '🔀',

  },

  {

    category: '格式转换',

    name: '云端格式转换',

    desc: '支持 200+ 格式，文档/图片/音视频/电子书互转',

    site: 'CloudConvert',

    url: 'https://cloudconvert.com/',

    icon: '☁️',

  },

  {

    category: '格式转换',

    name: '在线文件转换',

    desc: '拖拽即转，图片/文档/音频/视频常见格式',

    site: 'Convertio',

    url: 'https://convertio.co/zh/',

    icon: '📁',

  },

  {

    category: '格式转换',

    name: '免费多功能工具',

    desc: 'PDF、图片、视频、GIF 等几十种小工具，免注册可用',

    site: 'TinyWow',

    url: 'https://tinywow.com/',

    icon: '🧰',

  },



  // ── 效率辅助 ──

  {

    category: '效率辅助',

    name: '二维码生成',

    desc: '文本/链接生成二维码，可改颜色样式，适合分享链接',

    site: '草料二维码',

    url: 'https://cli.im/',

    icon: '📱',

  },

  {

    category: '效率辅助',

    name: 'JSON 格式化',

    desc: 'JSON 美化、压缩、校验，对接 API 时排查数据用',

    site: 'JSON.cn',

    url: 'https://www.json.cn/',

    icon: '{ }',

  },

  {

    category: '效率辅助',

    name: '在线工具箱合集',

    desc: '上百种免费小工具：转换、计算、编码、图片、文本等',

    site: '即时工具',

    url: 'https://www.67tool.com/',

    icon: '🛠️',

  },

  {

    category: '效率辅助',

    name: '开发者工具箱',

    desc: '时间戳、Base64、正则、哈希、单位换算等常用工具',

    site: '菜鸟工具',

    url: 'https://tool.lu/',

    icon: '⚙️',

  },

];



const CATEGORY_ORDER = ['图片处理', 'PDF / 文档', '格式转换', '效率辅助'];



function renderTools() {

  const wrap = document.getElementById('toolsWrap');

  if (!wrap) return;



  wrap.innerHTML = CATEGORY_ORDER.map((category) => {

    const items = TOOLS.filter((t) => t.category === category);

    if (!items.length) return '';



    const cards = items

      .map(

        (tool) => `

      <a class="tool-card" href="${tool.url}" target="_blank" rel="noopener noreferrer">

        <span class="tool-icon" aria-hidden="true">${tool.icon}</span>

        <div class="tool-body">

          <h3 class="tool-name">${tool.name}</h3>

          <p class="tool-desc">${tool.desc}</p>

          <span class="tool-site">${tool.site}</span>

        </div>

        <span class="tool-arrow" aria-hidden="true">↗</span>

      </a>`

      )

      .join('');



    return `

      <section class="card tool-section">

        <h2>${category}</h2>

        <div class="tool-grid">${cards}</div>

      </section>`;

  }).join('');

}



export function initToolsApp() {

  renderTools();

}


