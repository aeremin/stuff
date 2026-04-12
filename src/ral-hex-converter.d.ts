declare module "ral-hex-converter" {
  const converter: {
    toHex(ral: number | string): string;
    toRal(hex: string): string;
    rals: string[];
    hex: string[];
  };
  export default converter;
}
