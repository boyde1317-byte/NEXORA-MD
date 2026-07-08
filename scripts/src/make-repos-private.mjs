/**
 * Makes all GitHub repositories for a given user private using the GitHub API.
 * Requires GITHUB_PAT env var with `repo` scope.
 */

const USERNAME = "Boyde1317-byte";
const TOKEN = process.env.GITHUB_PAT;

if (!TOKEN) {
  console.error("ERROR: GITHUB_PAT environment variable is not set.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "replit-make-private-script",
};

async function fetchAllRepos() {
  const repos = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner`,
      { headers }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`Failed to list repos (HTTP ${res.status}): ${body}`);
      process.exit(1);
    }
    const batch = await res.json();
    if (batch.length === 0) break;
    repos.push(...batch);
    page++;
  }
  return repos;
}

async function makePrivate(repo) {
  if (repo.private) {
    console.log(`  [already private] ${repo.full_name}`);
    return { status: "skipped" };
  }
  const res = await fetch(`https://api.github.com/repos/${repo.full_name}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ private: true }),
  });
  if (res.ok) {
    console.log(`  [made private]    ${repo.full_name}`);
    return { status: "updated" };
  } else {
    const body = await res.text();
    console.error(`  [FAILED]          ${repo.full_name} — HTTP ${res.status}: ${body}`);
    return { status: "failed" };
  }
}

(async () => {
  console.log(`Fetching repos for ${USERNAME}…`);
  const repos = await fetchAllRepos();
  console.log(`Found ${repos.length} repo(s). Processing…\n`);

  let updated = 0, skipped = 0, failed = 0;
  for (const repo of repos) {
    const result = await makePrivate(repo);
    if (result.status === "updated") updated++;
    else if (result.status === "skipped") skipped++;
    else failed++;
  }

  console.log(`\nDone.`);
  console.log(`  Made private : ${updated}`);
  console.log(`  Already private: ${skipped}`);
  console.log(`  Failed       : ${failed}`);

  if (failed > 0) process.exit(1);
})();
