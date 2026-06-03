"""
Orchestrates all scrapers and assembles the master data payload.
Each scraper is wrapped in try/except so one failure doesn't abort the run.
"""

import json
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from scrapers import google_maps, google_trends, destatis, bundesagentur, nexxt_change, website_checker, economic_indices

console = Console()


def _run(label: str, fn, *args, **kwargs) -> dict:
    try:
        result = fn(*args, **kwargs)
        if isinstance(result, dict) and "error" in result:
            console.print(f"  [yellow]⚠ {label}:[/yellow] {result['error']}")
        else:
            console.print(f"  [green]✓[/green] {label}")
        return result
    except Exception as e:
        console.print(f"  [red]✗ {label}:[/red] {e}")
        return {"error": str(e)}


def collect_all(city: str, industry_type: str, zip_code: str, radius: int = 1000) -> dict:
    console.print(f"\n[bold cyan]Firmadeal — Data Collection[/bold cyan]")
    console.print(f"Target: [bold]{industry_type}[/bold] | {city} {zip_code} | radius {radius}m\n")

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), console=console) as p:
        task = p.add_task("Collecting data…", total=None)

        # 1. Google Maps (most important — run first)
        p.update(task, description="Google Maps — Places API…")
        maps_data = _run("Google Maps", google_maps.collect, city, industry_type, zip_code, radius)

        # 2. Website analysis for competitors
        competitors = maps_data.get("competitors", [])
        p.update(task, description="Website checker…")
        web_data = _run("Website Analysis", website_checker.collect, competitors)

        # 3. Google Trends
        p.update(task, description="Google Trends…")
        trends_data = _run("Google Trends", google_trends.collect, city, industry_type, zip_code)

        # 4. Destatis
        p.update(task, description="Destatis / GENESIS…")
        destatis_data = _run("Destatis", destatis.collect, city, industry_type, zip_code)

        # 5. Bundesagentur
        p.update(task, description="Bundesagentur für Arbeit…")
        ba_data = _run("Bundesagentur", bundesagentur.collect, city, industry_type, zip_code)

        # 6. nexxt-change listings
        p.update(task, description="nexxt-change.org listings…")
        nexxt_data = _run("nexxt-change", nexxt_change.collect, city, industry_type, zip_code)

        # 7. Economic indices
        p.update(task, description="Economic indices (ECB/IFO/KfW)…")
        econ_data = _run("Economic Indices", economic_indices.collect, city, industry_type, zip_code)

        p.update(task, description="Done.")

    # ── Data completeness score ───────────────────────────────────────────────
    sources = {
        "google_maps": maps_data,
        "website_analysis": web_data,
        "google_trends": trends_data,
        "destatis": destatis_data,
        "bundesagentur": ba_data,
        "nexxt_change": nexxt_data,
        "economic_indices": econ_data,
    }
    ok = sum(1 for v in sources.values() if "error" not in v)
    score = round(ok / len(sources) * 100)

    console.print(f"\n[bold]Data completeness: {score}% ({ok}/{len(sources)} sources)[/bold]\n")

    return {
        "meta": {
            "city": city,
            "industry_type": industry_type,
            "zip_code": zip_code,
            "radius_m": radius,
            "completeness_pct": score,
        },
        **sources,
    }
