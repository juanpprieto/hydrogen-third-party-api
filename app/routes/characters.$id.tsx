import {defer, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link, Await} from '@remix-run/react';
import {Suspense} from 'react';
import {CacheNone} from '@shopify/hydrogen';
import pMinDelay from 'p-min-delay';

export async function loader({context, params}: LoaderFunctionArgs) {
  // Initialize a promise to fetch episodes data with a delay to simulate
  // a slow connection or a slow GraphQL server
  const episodesPromise = pMinDelay(
    context.rickAndMorty.query<{character: {episode: Episode[]}}>(
      DEFERRED_CHARACTER_EPISODES_QUERY,
      {
        variables: {
          id: params.id,
        },
        cache: CacheNone(),
      },
    ),
    2000,
  );

  // Await fetch the "critical" above the fold character and locations data
  const characterPromise = context.rickAndMorty.query<{character: Character}>(
    CHARACTER_QUERY,
    {
      variables: {
        id: params.id,
      },
      cache: CacheNone(),
    },
  );

  const locationsPromise = context.rickAndMorty.query<{
    locations: {results: Location[]};
  }>(CHARACTER_LOCATIONS_QUERY, {
    variables: {},
    cache: CacheNone(),
  });

  // fetch character and locations data in parallel
  const [{character}, {locations}] = await Promise.all([
    characterPromise,
    locationsPromise,
  ]);

  return defer({character, locations, episodesPromise});
}

export default function Character() {
  const {character, locations, episodesPromise} =
    useLoaderData<typeof loader>();
  return (
    <div>
      <Link prefetch="intent" to="/">
        Back to all characters
      </Link>
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

      <Locations locations={locations.results} />

      <hr />

      <Suspense fallback={<EpisodesGrid />}>
        <Await
          resolve={episodesPromise}
          errorElement={<p>There was an error while fetching the episodes</p>}
        >
          {(data) => {
            if (!data?.character?.episode) {
              return <NoEpisodes />;
            }
            return (
              <EpisodesGrid
                episodes={data.character.episode as Array<Episode>}
              />
            );
          }}
        </Await>
      </Suspense>
    </div>
  );
}

function Locations({locations}: {locations: Location[]}) {
  return (
    <section>
      <h2>Locations</h2>
      <div
        style={{
          display: 'grid',
          gridGap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, 200px) 20%',
        }}
      >
        {locations.slice(0, 6).map((location) => (
          <div key={location.name}>
            <p>{location.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

type Location = {
  name: string;
  residents: {
    name: string;
    image: string;
  }[];
};

type Episode = {
  name: string;
  air_date: string;
  id: string;
  characters: {
    name: string;
    image: string;
    status: string;
  }[];
};

function EpisodesGrid({episodes}: {episodes?: Episode[]}) {
  const placeholderEpisode = {
    name: 'Loading...',
    air_date: '',
    id: '',
    characters: [{}, {}, {}],
  };

  let episodeNodes = [];

  if (!episodes?.length) {
    episodeNodes = new Array(4).fill(placeholderEpisode);
  } else {
    episodeNodes = episodes;
  }

  return (
    <div>
      <br />
      <h2>Episodes</h2>
      <p>
        Here we demonstrate Remix's deferred data fetching and streaming. With
        the help of <code>defer</code>, <code>Suspense</code> and{' '}
        <code>Await</code> we can render a placeholder while the request for
        episodes is ready without blocking the rendering process of the page
      </p>
      <br />
      <ul
        style={{
          display: 'grid',
          gridGap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, 200px) 20%',
        }}
      >
        {episodeNodes.slice(0, 4).map((episode, index) => (
          <li
            style={{
              padding: '.5rem',
              border: '1px solid black',
              minHeight: '100px',
              backgroundColor: episode.id ? 'white' : '#eee',
            }}
            key={episode.id + index}
          >
            {episode.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NoEpisodes() {
  return (
    <div>
      <h2>Episodes</h2>
      <p>Whoops, no episodes found!</p>
    </div>
  );
}

type Character = {
  name: string;
  id: string;
  gender: string;
  image: string;
  type: string;
  species: string;
  origin: {
    name: string;
  };
  location: {
    name: string;
  };
};

// NOTE: Awaiting for https://github.com/graphql/graphiql/pull/3411 to be merged
const CHARACTER_QUERY = `#graphql:rickAndMorty
  query characterQuery($id: ID!) {
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

const CHARACTER_LOCATIONS_QUERY = `#graphql:rickAndMorty
  query locationsQuery { 
    locations(page: 1) {
      results {
        name
        residents {
          name
          image
        }
      }
    }
  }
`;

const DEFERRED_CHARACTER_EPISODES_QUERY = `#graphql:rickAndMorty
  query deferredEpisodesQuery($id: ID!) { 
    character(id: $id) {
      episode {
        id
        name
        air_date
        characters {
          name
          image
          status
        }
      }
    }
  }
`;
