# Hydrogen Third-Party API Example (Deferred + Parallel data loading)

This example demonstrates how to use a third-party graphql client inside a
Hydrogen project. We use the [Rick & Morty API](https://rickandmortyapi.com/graphql)
to fetch some characters in the homepage and then link to a character page where
we show further details of the character.

## 1. Create a new third-party client

First, we create a cache-aware Rick & Morty API function that will
let us spin up a new client – just like we do with the Storefront API client. Here we
use the Hydrogen utility [createWithCache](https://shopify.dev/docs/api/hydrogen/2023-04/utilities/createwithcache)
to provide the client with a `cache` option that behaves just like that of the
storefront API client.

```ts
// filename: app/lob/createRickAndMortyClient.sever.ts

import {createWithCache, CacheLong, type WithCache} from '@shopify/hydrogen';

// TODO: replace with the correct type is exported from @shopify/hydrogen
type AllCacheOptions = Parameters<WithCache>[1];

export function createRickAndMortyClient({
  cache,
  waitUntil,
}: {
  cache: Cache;
  waitUntil: ExecutionContext['waitUntil'];
}) {
  const withCache = createWithCache({cache, waitUntil});

  async function query(
    query: `#graphql:rickAndMorty${string}`,
    options: {
      variables?: object;
      cache: AllCacheOptions;
    } = {variables: {}, cache: CacheLong()},
  ) {
    return withCache(
      ['r&m', query, JSON.stringify(options.variables)],
      options.cache,
      async function () {
        // call to the API
        const response = await fetch('https://rickandmortyapi.com/graphql', {
          method: 'POST',
          headers: {
            'Content-type': 'application/json',
          },
          body: JSON.stringify({
            query: query.replace('#graphql:rickAndMorty', ''),
            variables: options.variables,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Error fetching from rick and morty api: ${response.statusText}`,
          );
        }

        const json = (await response.json()) as unknown as {
          data: any;
          error: string;
        };

        return json.data;
      },
    );
  }

  return {query};
}
```

## 2. Instanciate the client and pass it to the Remix context

```ts
// filename: server.ts

// 1. Import the Rick and Morty client.
import {createRickAndMortyClient} from './app/lib/createRickAndMortyClient.server';

export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
  if (!env?.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  const waitUntil = executionContext.waitUntil.bind(executionContext);

  // ... other code

  // 3. Create a Rick and Morty client.
  const rickAndMorty = createRickAndMortyClient({
    cache: rickAndMortyCache,
    waitUntil,
  });

  // ... other code

  // 4. Pass the Rick and Morty client to the action and loader context.
  const handleRequest = createRequestHandler({
    build: remixBuild,
    mode: process.env.NODE_ENV,
    getLoadContext: () => ({
      // ...
      rickAndMorty,
    }),
  });

  // ... other code
}
```

## 3. Add the client's type to the Remix context (Typescript only)

```ts
// filename: remix.env.dts

import {createRickAndMortyClient} from './app/lib/createRickAndMortyClient.server';

// ... other code

declare module '@shopify/remix-oxygen' {
  export interface AppLoadContext {
    // ... other code
    rickAndMorty: ReturnType<typeof createRickAndMortyClient>;
  }
}
```

### 4. Making third-party API requests

<img width="981" alt="Screenshot 2023-11-13 at 3 51 32 PM" src="https://github.com/juanpprieto/hydrogen-third-party-api/assets/12080141/fe648c70-a979-4862-a173-4c0244543dec">

To render a list of [characters](https://rickandmortyapi.com/documentation/#graphql) from the API

```ts
// filename: app/routes/_index.tsx
import {CacheShort} from '@shopify/hydrogen';

// 1. Add the query to fetch characters
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

// 2. Fetch and return Rick & Morty characters
export async function loader({context}: LoaderFunctionArgs) {
  const {characters} = await context.rickAndMorty.query(CHARACTERS_QUERY, {
    cache: CacheShort(), // Adjust as needed
  });
  return json({characters});
}

// 3. Render the characters list
export default function Homepage() {
  const {characters} = useLoaderData<typeof loader>();
  return (
    <div>
      <h1>Rick & Morty Characters</h1>
      <ul>
        {(characters.results || []).map(
          (character: Character, index: number) => (
            <li key={character.name + index}>
              <Link to={'/characters/' + character.id}>{character.name}</Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
```

### Render the character page and defer the episodes

// TODO: add new screenshot

```ts
// filename: app/routes/characters.$id.tsx
import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link} from '@remix-run/react';
import {CacheNone} from '@shopify/hydrogen';

// 1. Add the character and episodes queries. We split them so that we can
// defer the query for episodes as it is not critical
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

const CHARACTER_EPISODES_QUERY = `#graphql:rickAndMorty
  query ($id: ID!) {
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

// 2. Await the fetch of the character and defer the episodes
export async function loader({context, params}: LoaderFunctionArgs) {
  // Initialize a promise to fetch episodes data with a delay to simulate
  // a slow connection or a slow GraphQL server
  const episodesPromise = pMinDelay(
    // Notice that we don't await it
    context.rickAndMorty.query(CHARACTER_EPISODES_QUERY, {
      variables: {
        id: params.id,
      },
      cache: CacheNone(),
    }),
    2000,
  );

  // Await fetch the "critical" above the fold character data
  const {character} = await context.rickAndMorty.query(CHARACTER_QUERY, {
    variables: {
      id: params.id,
    },
    cache: CacheNone(),
  });

  return defer({character, episodesPromise});
}

// 3. Render the character profile
export default function Character() {
  const {character, episodesPromise} = useLoaderData<typeof loader>();
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

      <hr />

      {/* Await the episodes promise and show a temporary placeholder */}
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

// 5. Create the EpisodesGrid and NoEpisodes components
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
```

### Add the Rick & Morty CDN to the CSP `img-src` directive

```ts
// filename: entry.server.ts

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  // 1. Add the Rick & Morty CDN to the list of allowed image sources
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    imgSrc: [
      'http://localhost:3000',
      'data:',
      'https://cdn.shopify.com',
      'https://shopify.com',
      'https://rickandmortyapi.com/api',
    ],
  });

  // ... other code
}
```

### That's it

Simply run, `h2 dev` and browse through some of the Rick & Morty clients inside
your Hydrogen storefront!

---;

## Hydrogen

Hydrogen is Shopify’s stack for headless commerce. Hydrogen is designed to dovetail with [Remix](https://remix.run/), Shopify’s full stack web framework. This template contains a **minimal setup** of components, queries and tooling to get started with Hydrogen.

[Check out Hydrogen docs](https://shopify.dev/custom-storefronts/hydrogen)
[Get familiar with Remix](https://remix.run/docs/en/v1)

## What's included

- Remix
- Hydrogen
- Oxygen
- Shopify CLI
- ESLint
- Prettier
- GraphQL generator
- TypeScript and JavaScript flavors
- Minimal setup of components and routes

## Getting started

**Requirements:**

- Node.js version 16.14.0 or higher

```bash
npm create @shopify/hydrogen@latest
```

## Building for production

```bash
npm run build
```

## Local development

```bash
npm run dev
```
