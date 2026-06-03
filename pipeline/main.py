#!/usr/bin/env python3
"""
Firmadeal Market Intelligence Pipeline
CLI entry point.

Usage:
    python main.py --city München --industry hotel --zip 80333
    python main.py --city Hamburg --industry restaurant --zip 20095 --radius 500
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel

load_dotenv()

console = Console()


def parse_args():
    p = argparse.ArgumentParser(
        description="Firmadeal — German SME Market Intelligence Report Generator",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--city", required=True, help="Target city (e.g. München)")
    p.add_argument("--industry", required=True, help="Industry type (hotel, restaurant, café, autowerkstatt, …)")
    p.add_argument("--zip", required=True, dest="zip_code", help="German postal code (e.g. 80333)")
    p.add_argument("--radius", type=int, default=1000, help="Search radius in meters")
    p.add_argument("--output", default=None, help="Output PDF path (default: auto-named)")
    p.add_argument("--json-only", action="store_true", help="Output raw JSON, skip PDF generation")
    p.add_argument("--no-ai", action="store_true", help="Skip Claude analysis (faster, no API cost)")
    return p.parse_args()


def main():
    args = parse_args()

    console.print(Panel.fit(
        "[bold cyan]Firmadeal Intelligence Pipeline[/bold cyan]\n"
        "[dim]German SME Market Report Generator[/dim]",
        border_style="cyan",
    ))

    # ── Check required env vars ───────────────────────────────────────────────
    missing = []
    if not os.getenv("GOOGLE_MAPS_API_KEY"):
        missing.append("GOOGLE_MAPS_API_KEY")
    if not args.no_ai and not os.getenv("CLAUDE_API_KEY"):
        missing.append("CLAUDE_API_KEY")

    if missing:
        console.print(f"[yellow]Warning: Missing env vars: {', '.join(missing)}[/yellow]")
        if "GOOGLE_MAPS_API_KEY" in missing:
            console.print("[red]GOOGLE_MAPS_API_KEY is required. Get one at console.cloud.google.com[/red]")
            sys.exit(1)

    # ── Collect data ──────────────────────────────────────────────────────────
    from collector import collect_all
    data = collect_all(
        city=args.city,
        industry_type=args.industry,
        zip_code=args.zip_code,
        radius=args.radius,
    )

    # ── Save raw JSON ─────────────────────────────────────────────────────────
    slug = f"{args.city.lower()}_{args.industry.lower()}_{args.zip_code}"
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    json_path = f"output/{slug}_{ts}_raw.json"
    Path("output").mkdir(exist_ok=True)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    console.print(f"\n[green]Raw data saved →[/green] {json_path}")

    # Print quick summary
    maps = data.get("google_maps", {})
    console.print(f"\n[bold]Quick Summary[/bold]")
    console.print(f"  Competitors found : {maps.get('competitor_count', 0)}")
    console.print(f"  Avg rating        : {maps.get('avg_rating', '—')}")
    console.print(f"  Total reviews     : {maps.get('total_market_reviews', 0)}")
    console.print(f"  nexxt listings    : {data.get('nexxt_change', {}).get('listing_count', 0)}")
    console.print(f"  Job signal        : {data.get('bundesagentur', {}).get('market_activity_signal', '—')}")

    if args.json_only:
        console.print("\n[dim]--json-only flag set. Skipping analysis + PDF.[/dim]")
        return

    # ── Claude analysis ───────────────────────────────────────────────────────
    analysis = {"analysis": "Keine KI-Analyse (--no-ai aktiviert)", "valuation_range": None}
    if not args.no_ai:
        console.print("\n[cyan]Running Claude analysis…[/cyan]")
        from analyzer import analyze
        analysis = analyze(data)
        if "error" in analysis:
            console.print(f"[yellow]Analysis warning: {analysis['error']}[/yellow]")
        else:
            console.print("[green]✓ Analysis complete[/green]")
            console.print(f"\n[bold]Valuation range:[/bold] "
                          f"{analysis.get('valuation_range', {})}")

    # ── Generate PDF ──────────────────────────────────────────────────────────
    pdf_path = args.output or f"output/{slug}_{ts}_report.pdf"
    console.print(f"\n[cyan]Generating PDF report…[/cyan]")
    from pdf_generator import generate
    generate(data, analysis, pdf_path)
    console.print(f"[bold green]✓ Report saved →[/bold green] [underline]{pdf_path}[/underline]")

    console.print("\n[bold]Done.[/bold]")


if __name__ == "__main__":
    main()
