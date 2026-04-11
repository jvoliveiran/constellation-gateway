import { parse, OperationDefinitionNode, FieldNode, Kind } from 'graphql';

/**
 * Extracts top-level field names from a GraphQL request body.
 * Returns an empty array if the body cannot be parsed (secure default — requires auth).
 */
export function extractOperationFields(body: unknown): string[] {
  if (!isGraphQLRequestBody(body)) {
    return [];
  }

  try {
    const document = parse(body.query);

    const operationNodes = document.definitions.filter(
      (def): def is OperationDefinitionNode =>
        def.kind === Kind.OPERATION_DEFINITION,
    );

    const fields: string[] = [];
    for (const operation of operationNodes) {
      for (const selection of operation.selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
          fields.push((selection as FieldNode).name.value);
        }
      }
    }

    return fields;
  } catch {
    return [];
  }
}

/**
 * Returns true only when ALL top-level fields in the request are in the allowlist.
 * A batched request mixing public and private operations is NOT public.
 */
export function isPublicOperation(
  fields: string[],
  allowlist: string[],
): boolean {
  return fields.length > 0 && fields.every((f) => allowlist.includes(f));
}

function isGraphQLRequestBody(body: unknown): body is { query: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'query' in body &&
    typeof (body as { query: unknown }).query === 'string'
  );
}
