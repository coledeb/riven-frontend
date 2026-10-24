<div align="center">
  <a href="https://github.com/rivenmedia/riven">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/rivenmedia/riven/main/assets/riven-light.png">
      <img alt="riven" src="https://raw.githubusercontent.com/rivenmedia/riven/main/assets/riven-dark.png">
    </picture>
  </a>
</div>

<div align="center">
  <a href="https://github.com/rivenmedia/riven/stargazers"><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/rivenmedia/riven?label=Riven+Backend"></a>
    <a href="https://github.com/rivenmedia/riven-frontend/stargazers"><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/rivenmedia/riven-frontend?label=Riven+Frontend"></a>
  <a href="https://github.com/rivenmedia/riven/issues"><img alt="Issues" src="https://img.shields.io/github/issues/rivenmedia/riven-frontend" /></a>
  <a href="https://github.com/rivenmedia/riven/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/rivenmedia/riven-frontend"></a>
  <a href="https://github.com/rivenmedia/riven/graphs/contributors-frontend"><img alt="Contributors" src="https://img.shields.io/github/contributors/rivenmedia/riven-frontend" /></a>
  <a href="https://discord.riven.tv"><img alt="Discord" src="https://img.shields.io/badge/Join%20discord-8A2BE2" /></a>
</div>

## Riven Frontend

This repository contains the frontend for Riven. It is build with [SvelteKit](https://kit.svelte.dev/).

> [!NOTE]
> **About this fork**
>
> This fork is the Frontend for my [Riven fork](https://github.com/coledeb/riven) (TorBox support and other fixes). It tracks upstream Riven Frontend and adds a reworked settings page, plus pages for the backend fork's features:
>
> - **Reworked settings page.** A sidebar of sections with a compact two-column layout; one form, so Save covers everything.
> - **Dropdowns and checkbox lists.** Choice fields from the backend schema show as selects, and lists of choices as checkboxes; language codes are dropdowns ("English (en)").
> - **Cleaner cards.** A service's Enabled switch sits on its title line, and disabled services collapse to their title and description.
> - **Settings search.** On the settings page, the header search box filters settings across every section.
> - **Secrets are masked.** API keys, tokens and passwords are hidden, with an eye button to reveal them.
> - **Saved values stay on screen.** After Save the form shows the stored settings, instead of resetting to the page-load values.
> - **Validation errors are easy to find.** Save jumps to the section with the error and flags it.
> - **Readable field descriptions.** Line breaks and **bold** in the backend's descriptions are shown.
> - **Blacklist dialog on media pages.** Lists the torrents Riven won't use for an item, with why, when it expires and strikes, and an Unblacklist button. Needs the backend fork.
> - **Blacklist tab in Logs.** Every blacklisting library-wide as it happens, with the same details. Needs the backend fork.
> - **Live item progress.** Status badges on media pages update as Riven works on an item (Scraping, Downloading...).
> - **A TVDB outage no longer breaks every page.** One shared TVDB login with a retry pause, instead of a 500 on every request.
> - **Users and logins survive restarts.** Without `DATABASE_URL` the database is `data/riven.db` (not in memory), and without `AUTH_SECRET` a generated secret is saved as `auth-secret` next to it.
> - **Settings search works in DUMB's embedded UI.** The settings page is detected under DUMB's `/ui/riven_frontend/` path too.
> - **No duplicate Profile item in the sidebar.** The avatar at the bottom already links to it.
>
> Multiple of these fixes came from (or were inspired by) upstream Riven Frontend [PRs](https://github.com/rivenmedia/riven-frontend/pulls).
>
> For full details of each change, see the [commits list](https://github.com/coledeb/riven-frontend/commits/main).

## Information

This fork was created for my personal use case, alongside my [Riven fork](https://github.com/coledeb/riven), allowing the interoperability of [DUMB](https://dumbarr.com/), TorBox, Riven, Torrentio, Debridio, Seerr, Plex, and Debrid Media Manager across WSL2 and Windows.

With this in mind, I have not created specific documentation for installation, configuration, etc. beyond what is written in this README.

I will be keeping this branch updated alongside upstream. It is built and tested with my Riven fork; the blacklist features need it, and I have *not* verified this Frontend against upstream Riven.

Please see the [upstream Riven Frontend README](https://github.com/rivenmedia/riven-frontend#readme) for more information. It *likely* applies to this fork too.

> [!NOTE]
> For DUMB stack users, see the [Riven fork's README](https://github.com/coledeb/riven#information) for the config of both Riven's Frontend and Backend. In short, for the **Riven Frontend:** set `repo_owner` to `coledeb`, `branch_enabled` to `true`, and `branch` to `main`.
> - Updating the Frontend **WILL** break the embedded UI in DUMB, as DUMB currently expects an older pinned version. See the [instructions](https://github.com/coledeb/riven/blob/main/scripts/DUMB.md#1-riven-frontend-in-dumbs-embedded-ui) in the Riven fork's [scripts](https://github.com/coledeb/riven/tree/main/scripts) folder for more information on this, as well as a fix.
> - In DUMB, set the Frontend's `DATABASE_URL` (e.g. `/data/riven-frontend/riven.db`) and, optionally, `AUTH_SECRET` in the service's environment. DUMB doesn't set them, and its updates replace the app folder, so the fork's default (`data/riven.db` there, with a generated `auth-secret` file beside it) loses users and logins on the next update.

I will possibly consider issues or pull requests on this fork, but I offer no guarantee of this.

## License

This project is licensed under the GNU GPLv3 License - see the [LICENSE](LICENSE) file for details
