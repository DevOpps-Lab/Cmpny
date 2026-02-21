"""Web scraping utilities: HTTP fetch, HTML cleaning, link extraction."""

import re
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup


# Reusable client — avoids creating a new TCP connection per request
_client = None


async def _get_client() -> httpx.AsyncClient:
    """Get or create a shared async HTTP client for connection reuse."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=8.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) "
                              "Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
    return _client


async def fetch_page(url: str, timeout: float = 8.0) -> tuple[str, int]:
    """Fetch a URL and return (html_content, status_code)."""
    client = await _get_client()
    resp = await client.get(url)
    return resp.text, resp.status_code


def html_to_markdown(html: str) -> str:
    """Convert HTML to clean, readable text/markdown."""
    soup = BeautifulSoup(html, "lxml")

    # Remove non-content elements
    for tag in soup.find_all(["script", "style", "nav", "footer", "header", "iframe", "noscript"]):
        tag.decompose()

    lines = []
    for elem in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "td", "th", "blockquote"]):
        text = elem.get_text(strip=True)
        if not text:
            continue
        tag = elem.name
        if tag == "h1":
            lines.append(f"# {text}")
        elif tag == "h2":
            lines.append(f"## {text}")
        elif tag == "h3":
            lines.append(f"### {text}")
        elif tag in ("h4", "h5", "h6"):
            lines.append(f"#### {text}")
        elif tag == "li":
            lines.append(f"- {text}")
        elif tag == "blockquote":
            lines.append(f"> {text}")
        else:
            lines.append(text)

    content = "\n\n".join(lines)
    # Collapse excessive whitespace
    content = re.sub(r"\n{3,}", "\n\n", content)
    return content.strip()


def extract_title(html: str) -> str:
    """Extract the page title from HTML."""
    soup = BeautifulSoup(html, "lxml")
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)
    return ""


def extract_links(html: str, base_url: str) -> list[str]:
    """Extract and normalize all internal links from a page."""
    soup = BeautifulSoup(html, "lxml")
    base_domain = urlparse(base_url).netloc
    links = set()

    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"].strip()
        # Skip anchors, mailto, javascript, etc.
        if href.startswith(("#", "mailto:", "javascript:", "tel:")):
            continue
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)
        # Only keep same-domain links
        if parsed.netloc == base_domain:
            # Normalize: strip fragment, keep path
            clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            if clean.endswith("/"):
                clean = clean[:-1]
            links.add(clean)

    return sorted(links)
