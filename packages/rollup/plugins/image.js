import path from "path";
import fs from "fs";
const mimeTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};
export function image(config) {
  return {
    id: "image",
    load(id) {
      if (!Object.keys(mimeTypes).includes(path.extname(id))) return null;
      const source = fs.readFileSync(id, "base64");
      return `var img=new Image();img.src="data:${
        mimeTypes[path.extname(id)]
      };base64,${source}";export default img; 
      `;
    },
  };
}
