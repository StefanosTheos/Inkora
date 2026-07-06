// Allow importing static image assets (Metro resolves these to an asset id).
declare module "*.png" {
  const content: number;
  export default content;
}
declare module "*.jpg" {
  const content: number;
  export default content;
}
declare module "*.webp" {
  const content: number;
  export default content;
}
