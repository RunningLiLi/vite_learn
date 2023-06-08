export function alias(config = {}) {
  if (!config) return null;
  return {
    name: "alias",
    resolveId(importee, importer, resolveOptions) {
      let newPath = importee;
      Object.keys(config).map((key) => {
        if (importee.includes(key)) {
          newPath = importee.replace(key, config[key]);
        }
      });
      return this.resolve(
        newPath,
        importer,
        Object.assign({ skipSelf: true }, resolveOptions)
      ).then((resolved) => {
        let finalResult = resolved;
        if (!finalResult) {
          return {
            id: newPath,
          };
        } else {
          return finalResult;
        }
      });
    },
  };
}
