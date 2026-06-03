import { resolveBoundImplementationDefinitionContext } from "../context/phpDefinitionContext";
import type { LaravelIndex } from "../indexer";
import type { SourceLocation } from "../indexer/types";
import type { Logger } from "../logging/logger";

export function resolveBoundImplementationDefinition(
  index: LaravelIndex,
  logger: Logger,
  text: string,
  offset: number,
): SourceLocation | undefined {
  const boundContext = resolveBoundImplementationDefinitionContext(text, offset);
  if (boundContext.kind === "method") {
    const item = index.findContainerMethodByAbstract(boundContext.abstractClass, boundContext.method);
    if (item) {
      logger.debug("[resolveBoundImplementationDefinition] bound implementation method match", {
        abstractClass: boundContext.abstractClass,
        concreteClass: item.concreteClass,
        method: boundContext.method,
        file: item.source.file,
      });

      return item.source;
    }

    logger.debug("[resolveBoundImplementationDefinition] no bound implementation method match", {
      abstractClass: boundContext.abstractClass,
      method: boundContext.method,
      receiver: boundContext.receiver,
    });
    return undefined;
  }

  if (boundContext.kind === "class") {
    const item = index.findContainerBindingByAbstract(boundContext.abstractClass);
    const source = item?.concreteSource ?? item?.source;
    if (item && source) {
      logger.debug("[resolveBoundImplementationDefinition] bound implementation class match", {
        abstractClass: boundContext.abstractClass,
        concreteClass: item.concreteClass,
        file: source.file,
      });

      return source;
    }

    logger.debug("[resolveBoundImplementationDefinition] no bound implementation class match", {
      abstractClass: boundContext.abstractClass,
    });
    return undefined;
  }

  if (boundContext.reason === "no-typed-receiver") {
    logger.debug("[resolveBoundImplementationDefinition] no bound implementation context", {
      reason: boundContext.reason,
    });
  }

  return undefined;
}
