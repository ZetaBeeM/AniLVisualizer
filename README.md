# AniLViewer

<img width="1920" height="1080" alt="20261026_231910" src="https://github.com/user-attachments/assets/1c604cd5-e0d7-4b60-959d-166d67bb8fa5" />


Visualize completed AniList entries as a graph: each one is a node, and prequel/sequel/spin-offs between entries are drawn as edges. 

Project was made with the intention to experiment with graph visualization libraries in Javascript (for data analysis), and it just so happened that this worked for it due to AniList's schema being well documented and their GraphQL API being easy to work with, and it taught me how to structure querries so that I wouldn't get rate limited.

### Features
- Enter an AniList username to load a user's completed anime list.
- Hover a node to see dates, rewatches and its connections, and click it to show a detailed card with the show's poster and synopsis.
- Search for an entry, and filter by format or hide standalone entries.

The last fetched list is cached in `localStorage` and if the same username associated to it is entered into the search, the site reuses that data to avoid excessive querrying.

## Development

```sh
npm install
npm run dev
```

`npm run build` outputs a static site to `dist/`.

Made with React, Vite, Tailwind CSS, Sigma.js and Graphology. Data from the
[AniList GraphQL API](https://docs.anilist.co/).
