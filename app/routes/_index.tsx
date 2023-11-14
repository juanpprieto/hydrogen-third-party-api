import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link} from '@remix-run/react';
import {CacheShort} from '@shopify/hydrogen';

export async function loader({context}: LoaderFunctionArgs) {
  // NOTE: We're using a short cache here to avoid re-fetching the characters
  const {characters} = await context.rickAndMorty.query(CHARACTERS_QUERY, {
    cache: CacheShort(),
  });
  return json({characters});
}

// TODO: Remove when we add 3P codegen support
type Character = {
  name: string;
  id: string;
};

export default function Homepage() {
  const {characters} = useLoaderData<typeof loader>();
  return (
    <div>
      <h1>Rick & Morty Characters</h1>
      <ul>
        {(characters.results || []).map(
          (character: Character, index: number) => (
            <li key={character.name + index}>
              <Link prefetch="intent" to={'/characters/' + character.id}>
                {character.name}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

// NOTE: Awaiting for https://github.com/graphql/graphiql/pull/3411 to be merged
const CHARACTERS_QUERY = `#graphql:rickAndMorty
  query {
    characters(page: 1) {
      results {
        name
        id
      }
    }
  }
`;
