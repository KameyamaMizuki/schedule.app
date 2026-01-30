const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DOG_IMAGES_DIR = path.join(__dirname, '../web/images/dog');
const OUTPUT_SIZE = 300; // 150x150の2倍（Retina対応）
const QUALITY = 80;

async function optimizeImages() {
  const expressions = ['normal', 'happy', 'thinking', 'sad'];

  for (const expr of expressions) {
    const inputDir = path.join(DOG_IMAGES_DIR, expr);
    const outputDir = path.join(DOG_IMAGES_DIR, expr, 'optimized');

    // 出力フォルダを作成
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 画像ファイルを取得
    const files = fs.readdirSync(inputDir).filter(f =>
      /\.(jpg|jpeg|png)$/i.test(f) && !f.includes('optimized')
    );

    console.log(`\n[${expr}] ${files.length}枚を最適化中...`);

    for (const file of files) {
      const inputPath = path.join(inputDir, file);
      const outputFile = file.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const outputPath = path.join(outputDir, outputFile);

      try {
        const stats = fs.statSync(inputPath);
        const originalSize = (stats.size / 1024).toFixed(1);

        await sharp(inputPath)
          .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
            fit: 'cover',
            position: 'center'
          })
          .webp({ quality: QUALITY })
          .toFile(outputPath);

        const newStats = fs.statSync(outputPath);
        const newSize = (newStats.size / 1024).toFixed(1);

        console.log(`  ✓ ${file} (${originalSize}KB → ${newSize}KB)`);
      } catch (err) {
        console.error(`  ✗ ${file}: ${err.message}`);
      }
    }
  }

  console.log('\n最適化完了！');
}

optimizeImages().catch(console.error);