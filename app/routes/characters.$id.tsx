import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link} from '@remix-run/react';
import {CacheNone} from '@shopify/hydrogen';

export async function loader({context, params}: LoaderFunctionArgs) {
  // Fetch character data
  const {character} = await context.rickAndMorty.query(CHARACTER_QUERY, {
    variables: {
      id: params.id,
    },
    cache: CacheNone(),
  });
  return json({character});
}

export default function Character() {
  const {character} = useLoaderData<typeof loader>();
  return (
    <div>
      <Link to="/">Back to all characters</Link>
      <h1>{character.name}</h1>
      <img src={character.image} alt={character.name} />
      <ul>
        {character.type && (
          <li>
            <strong>Type:</strong>
            {character.type}
          </li>
        )}
        <li>
          <strong>Species:</strong>
          {character.species}
        </li>
        <li>
          <strong>Gender:</strong>
          {character.gender}
        </li>
        <li>
          <strong>Origin:</strong>
          {character.origin.name}
        </li>
        <li>
          <strong>Location:</strong>
          {character.location.name}
        </li>
      </ul>
    </div>
  );
}

// NOTE: Awaiting for https://github.com/graphql/graphiql/pull/3411 to be merged
const CHARACTER_QUERY = `#graphql:rickAndMorty
  query($id: ID!) {
    character(id: $id) {
      name
      id
      gender
      image
      type
      species
      origin {
        name
      }
      location {
        name
      }
    }
  }
`;
