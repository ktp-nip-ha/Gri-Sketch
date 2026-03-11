/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // 【追加】GitHub Pagesのリポジトリ名を指定します
  // これにより、CSSや画像を探す場所が /Gri-Sketch/ に修正されます
  basePath: '/Gri-Sketch', 
  assetPrefix: '/Gri-Sketch', 
};

export default nextConfig;