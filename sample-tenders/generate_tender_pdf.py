"""
Generates sample tender PDFs from a single template.

Each scenario is just a dict of values (payment terms, liability cap,
retention %, experience requirements, LD rate, schedule notes, etc).
Change the values in SCENARIOS below to produce a different score profile
(legal / engineering / accounting / risk) without touching the layout code.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TenderTitle", fontSize=15, leading=18, spaceAfter=4,
                           alignment=TA_CENTER, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="TenderSubtitle", fontSize=11, leading=14, spaceAfter=14,
                           alignment=TA_CENTER, fontName="Helvetica"))
styles.add(ParagraphStyle(name="Section", fontSize=12.5, leading=16, spaceBefore=16,
                           spaceAfter=6, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="SubSection", fontSize=11, leading=14, spaceBefore=6,
                           spaceAfter=4, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="Body", fontSize=10, leading=14))
styles.add(ParagraphStyle(name="TenderBullet", fontSize=10, leading=14, leftIndent=16,
                           bulletIndent=4))


def build_tender_pdf(cfg: dict, output_path: str):
    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
    )
    s = []

    s.append(Paragraph(f"TENDER DOCUMENT &mdash; {cfg['ref_number']}", styles["TenderTitle"]))
    s.append(Paragraph(cfg["contract_title"], styles["TenderSubtitle"]))

    s.append(Paragraph("1. PROJECT OVERVIEW", styles["Section"]))
    overview_rows = [
        ["Project Name", cfg["project_name"]],
        ["Location", cfg["location"]],
        ["Project Value", cfg["project_value"]],
        ["Duration", cfg["duration"]],
        ["Client", cfg["client"]],
    ]
    t = Table(overview_rows, colWidths=[1.6 * inch, 4.6 * inch])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.lightgrey),
    ]))
    s.append(t)

    s.append(Paragraph("2. FINANCIAL REQUIREMENTS", styles["Section"]))
    for line in cfg["financial_terms"]:
        s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))

    s.append(Paragraph("3. TECHNICAL SCOPE", styles["Section"]))
    s.append(Paragraph("3.1 Scope Includes", styles["SubSection"]))
    for line in cfg["scope_items"]:
        s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))
    s.append(Paragraph("3.2 Site Conditions", styles["SubSection"]))
    for line in cfg["site_conditions"]:
        s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))
    s.append(Paragraph("3.3 Timeline", styles["SubSection"]))
    for line in cfg["timeline"]:
        s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))

    s.append(Paragraph("4. EXPERIENCE REQUIREMENTS", styles["Section"]))
    for line in cfg["experience_requirements"]:
        s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))

    s.append(Paragraph("5. CONTRACT TERMS AND CONDITIONS", styles["Section"]))
    s.append(Paragraph("5.1 Liability", styles["SubSection"]))
    for line in cfg["liability_terms"]:
        s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))
    s.append(Paragraph("5.2 Termination", styles["SubSection"]))
    for line in cfg["termination_terms"]:
        s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))
    s.append(Paragraph("5.3 Disputes", styles["SubSection"]))
    for line in cfg["dispute_terms"]:
        s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))

    if cfg.get("warranty_terms"):
        s.append(Paragraph("5.4 Warranty", styles["SubSection"]))
        for line in cfg["warranty_terms"]:
            s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))

    if cfg.get("force_majeure_terms"):
        s.append(Paragraph("5.5 Force Majeure", styles["SubSection"]))
        for line in cfg["force_majeure_terms"]:
            s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))

    if cfg.get("compliance_terms"):
        s.append(Paragraph("5.6 Legal and Regulatory Compliance", styles["SubSection"]))
        for line in cfg["compliance_terms"]:
            s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))

    s.append(Paragraph("6. PERFORMANCE SECURITY AND INSURANCE", styles["Section"]))
    for line in cfg["security_terms"]:
        s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))

    s.append(Paragraph("7. LIQUIDATED DAMAGES", styles["Section"]))
    for line in cfg["ld_terms"]:
        s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))

    s.append(Paragraph("8. EVALUATION CRITERIA", styles["Section"]))
    for line in cfg["evaluation_criteria"]:
        s.append(Paragraph(f"&bull; {line}", styles["TenderBullet"]))

    s.append(Spacer(1, 16))
    s.append(Paragraph(f"DOCUMENT CLASSIFICATION: {cfg['classification']}", styles["Body"]))
    s.append(Paragraph(f"EXPECTED SCENARIO PROFILE: {cfg['expected_profile']}", styles["Body"]))

    doc.build(s)
    print(f"Wrote {output_path}")


SCENARIOS = {
    "strong-bid": dict(
        ref_number="RFT 2201-WWTP-0004",
        contract_title="CONSTRUCTION CONTRACT — MUNICIPAL WATER TREATMENT UPGRADE",
        project_name="Riverside Water Treatment Plant Upgrade",
        location="Riverside Municipal District",
        project_value="USD 6.2 Million",
        duration="18 months from Notice to Proceed",
        client="Riverside Municipal Water Authority",
        financial_terms=[
            "Contract Value: USD 6,200,000 (fixed price lump sum)",
            "Payment Terms: Monthly invoicing based on certified work completion",
            "Milestone payments spread evenly across mobilization, civil works, "
            "mechanical installation, and commissioning, each with clear acceptance criteria",
            "Retention: 5% holdback, released 3 months after final acceptance",
            "Performance Bond: 10% of contract value, standard industry form",
            "Payment Terms: Net 30 days from invoice date; no history of late payment by this client",
        ],
        scope_items=[
            "Upgrade of existing clarifier and filtration systems",
            "Replacement of pumps and control instrumentation",
            "Minor civil works to existing structures, no new foundations required",
        ],
        site_conditions=[
            "Site fully accessible, existing utilities documented and verified",
            "Geotechnical survey confirms stable soil, no unusual conditions",
            "Plant remains partially operational during works; sequencing plan provided by client",
        ],
        timeline=[
            "Engineering: Months 1-3",
            "Procurement: Months 2-6 (standard 8-10 week lead times)",
            "Installation: Months 6-15",
            "Commissioning: Months 16-18, timeline assessed as comfortable and achievable",
        ],
        experience_requirements=[
            "Minimum 5 years experience in municipal water infrastructure",
            "Minimum 2 completed projects of similar scale",
            "Minimum annual turnover USD 10 Million for last 2 years",
            "ISO 9001 certification required",
            "Project Manager: Minimum 8 years relevant experience",
            "Minimum 2 references from completed municipal projects",
        ],
        liability_terms=[
            "Contractor liability capped at 20% of contract value for direct damages",
            "No liability cap for gross negligence or willful misconduct",
        ],
        termination_terms=[
            "Client may terminate for convenience with 30 days notice; contractor paid "
            "for work completed plus reasonable demobilization costs",
            "Either party may terminate for material breach with 30 days notice if not cured",
        ],
        dispute_terms=[
            "Disputes resolved by local arbitration under the law of the project jurisdiction",
        ],
        security_terms=[
            "Performance Bond: 10% of contract value",
            "Insurance Requirements: General Liability minimum USD 2 Million per occurrence",
        ],
        ld_terms=[
            "Schedule Delay Penalties: 0.25% of contract value per week of delay, capped at 3% total",
        ],
        evaluation_criteria=[
            "Technical Capability: 35%",
            "Financial: 50%",
            "HSE & Compliance: 15%",
        ],
        classification="CONSTRUCTION CONTRACT",
        expected_profile="LOW risk / PROCEED",
    ),
    "moderate-risk": dict(
        ref_number="RFT 5540-DCB-0012",
        contract_title="DESIGN-BUILD CONTRACT — COMMERCIAL DISTRIBUTION CENTER",
        project_name="Northgate Distribution Center",
        location="Northgate Logistics Park",
        project_value="USD 9.8 Million",
        duration="15 months from Notice to Proceed",
        client="Northgate Logistics Holdings",
        financial_terms=[
            "Contract Value: USD 9,800,000 (fixed price lump sum)",
            "Payment Terms: Monthly invoicing based on certified work completion",
            "Milestone payments: 10% mobilization / 50% structural completion (single combined "
            "milestone) / 40% final handover",
            "Retention: 10% holdback from each invoice, released 9 months after completion",
            "Performance Bond: 10% of contract value, within 10 days of award",
            "Payment Terms: Net 45 days from invoice date",
        ],
        scope_items=[
            "Design development and detailed engineering",
            "Tilt-up concrete structure and structural steel racking mezzanine",
            "Electrical, fire protection, and HVAC systems",
        ],
        site_conditions=[
            "Site access limited to a single entry point shared with an active neighboring facility",
            "Geotechnical survey indicates variable fill material to 3m depth, further "
            "investigation recommended",
        ],
        timeline=[
            "Engineering & Procurement: Months 1-3",
            "Structural works: Months 3-9",
            "Fit-out and commissioning: Months 10-15, schedule described by client as aggressive "
            "given the fill remediation uncertainty",
        ],
        experience_requirements=[
            "Minimum 8 years experience in design-build commercial construction",
            "Minimum 3 completed projects of similar scale",
            "Minimum annual turnover USD 20 Million for last 3 years",
            "ISO 9001 and ISO 14001 certifications required; local safety accreditation "
            "considered strict for regional bidders without an existing local presence",
            "Project Manager: Minimum 10 years design-build experience",
        ],
        liability_terms=[
            "Contractor liability capped at 15% of contract value for direct damages",
            "No liability cap for gross negligence or IP infringement",
        ],
        termination_terms=[
            "Client may terminate for convenience with 45 days notice",
            "Either party may terminate for material breach with 21 days notice if not cured",
            "Contractor has 7 days to submit cost impact of change orders, shorter than "
            "typical industry practice",
        ],
        dispute_terms=[
            "Disputes subject to arbitration in a jurisdiction outside the contractor's home region",
        ],
        security_terms=[
            "Performance Bond: 10% of contract value",
            "Insurance Requirements: General Liability minimum USD 5 Million per occurrence",
        ],
        ld_terms=[
            "Schedule Delay Penalties: 0.5% of contract value per week of delay, capped at 7.5% total",
        ],
        evaluation_criteria=[
            "Technical Capability: 40%",
            "Financial: 40%",
            "HSE & Compliance: 20%",
        ],
        classification="DESIGN-BUILD CONTRACT",
        expected_profile="MEDIUM risk / PROCEED_WITH_CAUTION",
    ),
    "high-risk": dict(
        ref_number="RFT 9012-REF-0088",
        contract_title="EPC CONTRACT — OFFSHORE REFINERY EXPANSION (REMOTE SITE)",
        project_name="Offshore Refinery Unit 4 Expansion",
        location="Remote coastal site, no existing road access",
        project_value="USD 42 Million",
        duration="14 months from Notice to Proceed",
        client="Consolidated Petrochemical Holdings",
        financial_terms=[
            "Contract Value: USD 42,000,000 (fixed price lump sum, no escalation clause)",
            "Payment Terms: Single payment upon full completion and client acceptance; "
            "no interim milestone payments during construction",
            "Retention: 15% holdback from final payment, released 18 months after project "
            "completion pending client discretion",
            "Performance Bond: 25% of contract value, to be provided within 5 days of award",
            "Payment Terms: Net 90 days from invoice date; client has history of disputed invoices",
        ],
        scope_items=[
            "Full EPC for new processing unit including marine works",
            "Design, procurement, and construction of subsea pipeline tie-ins",
            "Civil works on unconsolidated coastal fill with no prior geotechnical data",
        ],
        site_conditions=[
            "No existing road access; all materials via seasonal barge access only",
            "Geotechnical survey not yet performed; bidder to assume soil conditions and bear "
            "risk of unforeseen ground conditions",
            "Environmental zoning: protected coastal area with unresolved permitting status",
        ],
        timeline=[
            "Full EPC scope, including subsea works, to be completed in 14 months, a schedule "
            "the client acknowledges as highly aggressive relative to comparable projects",
            "Equipment lead times for specialized subsea components exceed 10 months, leaving "
            "effectively no float for installation or commissioning",
        ],
        experience_requirements=[
            "Minimum 20 years experience in offshore EPC construction",
            "Minimum 5 completed projects of comparable scale and complexity",
            "Minimum annual turnover USD 200 Million for last 5 years",
            "Bidder must hold existing marine construction license in this jurisdiction",
            "Project Manager: Minimum 20 years offshore EPC experience",
            "Minimum 5 references from completed offshore projects over USD 30 Million",
        ],
        liability_terms=[
            "Contractor liability uncapped for all damages, direct and consequential",
            "Contractor indemnifies Client for all third-party claims without limit",
        ],
        termination_terms=[
            "Client may terminate for convenience at any time with no notice period and no "
            "compensation for demobilization costs",
            "Contractor has no corresponding termination right for client payment default",
            "Client may issue changes unilaterally; contractor must proceed before price is agreed",
        ],
        dispute_terms=[
            "All disputes subject to litigation in client's home jurisdiction only; contractor "
            "waives right to arbitration",
        ],
        security_terms=[
            "Performance Bond: 25% of contract value",
            "Insurance Requirements: General Liability minimum USD 50 Million per occurrence, "
            "with contractor required to self-insure marine transit risk",
        ],
        ld_terms=[
            "Schedule Delay Penalties: 2% of contract value per week of delay, uncapped",
            "Performance Shortfalls: 5% deduction per percentage point below specification, uncapped",
        ],
        evaluation_criteria=[
            "Financial: 60%",
            "Technical Capability: 30%",
            "HSE & Compliance: 10%",
        ],
        classification="EPC CONTRACT",
        expected_profile="HIGH risk / DO_NOT_PROCEED",
    ),
    "guaranteed-yes": dict(
        ref_number="RFT 1000-SVC-0002",
        contract_title="CONSTRUCTION CONTRACT — WAREHOUSE ROOF REPLACEMENT",
        project_name="Eastfield Warehouse Roof Replacement",
        location="Eastfield Industrial Estate",
        project_value="USD 1.4 Million",
        duration="6 months from Notice to Proceed",
        client="Eastfield Logistics Co.",
        financial_terms=[
            "Contract Value: USD 1,400,000 (fixed price lump sum)",
            "Payment Terms: Monthly invoicing based on certified work completion",
            "Milestone payments spread evenly across mobilization, roof strip-out, "
            "new roof installation, and final handover, each with clear acceptance criteria",
            "Retention: 5% holdback, released 1 month after final acceptance",
            "Performance Bond: 5% of contract value, standard industry form",
            "Payment Terms: Net 30 days from invoice date; client has an excellent payment history",
        ],
        scope_items=[
            "Removal of existing roof sheeting and insulation",
            "Installation of new insulated roof panels and flashing",
            "Like-for-like replacement, no structural modification required",
        ],
        site_conditions=[
            "Site fully accessible with dedicated laydown area provided by client",
            "Existing utilities fully documented; no known hazards",
            "Geotechnical conditions not applicable - roof-only scope, no ground works",
        ],
        timeline=[
            "Mobilization: Month 1",
            "Roof strip-out and replacement: Months 2-5, standard off-the-shelf materials "
            "with 2-3 week lead times",
            "Final handover: Month 6, schedule assessed by client as comfortable with float",
        ],
        experience_requirements=[
            "Minimum 3 years experience in commercial roofing contracts",
            "Minimum 2 completed projects of similar scale",
            "Minimum annual turnover USD 2 Million for last 2 years",
            "Standard trade liability insurance required",
        ],
        liability_terms=[
            "Contractor liability capped at 20% of contract value for direct damages",
            "No liability cap for gross negligence or willful misconduct",
        ],
        termination_terms=[
            "Client may terminate for convenience with 30 days notice; contractor paid "
            "for work completed plus reasonable demobilization costs",
            "Either party may terminate for material breach with 30 days notice if not cured",
            "Contractor has 14 days to submit cost impact of any change order",
        ],
        dispute_terms=[
            "Disputes resolved by local mediation, then arbitration, under the law of the "
            "project jurisdiction",
        ],
        security_terms=[
            "Performance Bond: 5% of contract value",
            "Insurance Requirements: General Liability minimum USD 2 Million per occurrence",
        ],
        ld_terms=[
            "Schedule Delay Penalties: 0.1% of contract value per week of delay, capped at 2% total",
        ],
        evaluation_criteria=[
            "Technical Capability: 30%",
            "Financial: 55%",
            "HSE & Compliance: 15%",
        ],
        classification="CONSTRUCTION CONTRACT",
        expected_profile="LOW risk / PROCEED (bid_decision: YES)",
    ),
    "all-green": dict(
        ref_number="RFT 1000-SVC-0003",
        contract_title="CONSTRUCTION CONTRACT — OFFICE FIT-OUT REFURBISHMENT",
        project_name="Meridian Business Park Office Fit-Out",
        location="Meridian Business Park, Building 4",
        project_value="USD 850,000",
        duration="4 months from Notice to Proceed",
        client="Meridian Business Park Management Ltd.",
        financial_terms=[
            "Contract Value: USD 850,000 (fixed price lump sum)",
            "Payment Terms: Monthly invoicing based on certified work completion",
            "Milestone payments spread evenly across mobilization, demolition/strip-out, "
            "fit-out installation, and final handover, each with clear acceptance criteria",
            "Retention: 5% holdback, released 1 month after final acceptance",
            "Performance Bond: 5% of contract value, standard industry form",
            "Payment Terms: Net 30 days from invoice date; client has an excellent, "
            "well-documented payment history with no disputed invoices on record",
        ],
        scope_items=[
            "Interior demolition and strip-out of existing partitions and finishes",
            "New partitions, ceilings, flooring, and interior finishes",
            "Like-for-like mechanical and electrical reconnection, no new structural "
            "or load-bearing work required",
        ],
        site_conditions=[
            "Site fully accessible during normal business hours with dedicated "
            "contractor access and laydown area provided by client",
            "Existing utilities fully documented and verified; no known hazards or "
            "hazardous materials present",
            "Interior fit-out only - no ground works, no geotechnical considerations",
        ],
        timeline=[
            "Mobilization and design coordination: Month 1",
            "Strip-out and fit-out installation: Months 2-3, standard off-the-shelf "
            "materials with 2-3 week lead times",
            "Final handover and snagging: Month 4, schedule assessed by client as "
            "comfortable with built-in float",
        ],
        experience_requirements=[
            "Minimum 3 years experience in commercial interior fit-out contracts",
            "Minimum 2 completed projects of similar scale",
            "Minimum annual turnover USD 1.5 Million for last 2 years",
            "Standard trade liability insurance and local trade license required",
        ],
        liability_terms=[
            "Contractor liability capped at 20% of contract value for direct damages",
            "No liability cap for gross negligence or willful misconduct",
            "Mutual indemnification: each party indemnifies the other only for claims "
            "arising from its own negligence or breach, with indemnity capped at the "
            "same 20% of contract value",
        ],
        termination_terms=[
            "Client may terminate for convenience with 30 days notice; contractor paid "
            "for work completed plus reasonable demobilization costs",
            "Either party may terminate for material breach with 30 days notice if not cured",
            "Contractor has 14 days to submit cost impact of any change order, and no "
            "change proceeds without prior written agreement on price",
        ],
        dispute_terms=[
            "Disputes resolved by good-faith negotiation, then mediation, then binding "
            "arbitration under the law of the project jurisdiction",
        ],
        warranty_terms=[
            "Defects liability period: 12 months from practical completion",
            "Contractor warrants all workmanship and materials to be free of defects "
            "and to conform to the agreed specification",
            "Contractor liable for defect rectification at no additional cost during "
            "the warranty period",
        ],
        force_majeure_terms=[
            "Standard force majeure clause covering acts of God, natural disasters, "
            "war, and government-ordered restrictions",
            "Force majeure notification required within 14 days of occurrence",
            "Either party may terminate without penalty if a force majeure event "
            "persists beyond 90 days",
        ],
        compliance_terms=[
            "Contractor shall perform all work in compliance with applicable local "
            "building codes, fire and life-safety regulations, and occupational "
            "health and safety law",
            "All works subject to inspection and sign-off by the local building authority",
            "Contractor to hold and maintain all licenses and permits required for "
            "the scope of work",
        ],
        security_terms=[
            "Performance Bond: 5% of contract value",
            "Insurance Requirements: General Liability minimum USD 2 Million per occurrence",
        ],
        ld_terms=[
            "Schedule Delay Penalties: 0.1% of contract value per week of delay, capped at 2% total",
        ],
        evaluation_criteria=[
            "Technical Capability: 30%",
            "Financial: 55%",
            "HSE & Compliance: 15%",
        ],
        classification="CONSTRUCTION CONTRACT",
        expected_profile="LOW risk / PROCEED - legal GREEN, engineering HIGH feasibility",
    ),
    "caution": dict(
        ref_number="RFT 3300-IND-0007",
        contract_title="CONSTRUCTION CONTRACT — LIGHT INDUSTRIAL UNIT EXTENSION",
        project_name="Kingsford Light Industrial Unit Extension",
        location="Kingsford Business Park, Plot 12",
        project_value="USD 3.6 Million",
        duration="10 months from Notice to Proceed",
        client="Kingsford Properties Group",
        financial_terms=[
            "Contract Value: USD 3,600,000 (fixed price lump sum)",
            "Payment Terms: Monthly invoicing based on certified work completion",
            "Milestone payments: 15% mobilization / 35% structural completion / 35% "
            "fit-out and services / 15% final handover",
            "Retention: 8% holdback from each invoice, released 4 months after "
            "final acceptance",
            "Performance Bond: 10% of contract value, to be provided within 14 days of award",
            "Payment Terms: Net 45 days from invoice date",
        ],
        scope_items=[
            "Single-storey steel-framed extension to existing warehouse unit",
            "New concrete slab and foundations tying into the existing structure",
            "Mechanical, electrical, and fire suppression extension to cover the new area",
        ],
        site_conditions=[
            "Site accessible via a shared access road also used by the client's "
            "ongoing operations, requiring coordinated delivery scheduling",
            "Preliminary geotechnical survey suggests generally stable soil, but a "
            "full site investigation has not yet been completed and is recommended "
            "before foundation design is finalized",
            "Existing utilities documented but tie-in points require verification "
            "during detailed design",
        ],
        timeline=[
            "Design and permitting: Months 1-2",
            "Foundations and structural steel: Months 3-6, dependent on completing "
            "the outstanding geotechnical investigation early in this window",
            "Fit-out and M&E: Months 6-9",
            "Commissioning and handover: Month 10, schedule has limited float given "
            "the dependency on the pending site investigation",
        ],
        experience_requirements=[
            "Minimum 6 years experience in light industrial construction",
            "Minimum 2 completed projects of similar scale",
            "Minimum annual turnover USD 8 Million for last 3 years",
            "ISO 9001 certification required",
        ],
        liability_terms=[
            "Contractor liability capped at 25% of contract value for direct damages",
            "No liability cap for gross negligence or willful misconduct",
            "Mutual indemnification for third-party claims arising from each party's "
            "own negligence, capped at the same 25% of contract value",
        ],
        termination_terms=[
            "Client may terminate for convenience with 45 days notice; contractor "
            "paid for work completed plus reasonable demobilization costs",
            "Either party may terminate for material breach with 30 days notice if not cured",
            "Contractor has 10 days to submit cost impact of any change order",
            "If actual site or ground conditions differ materially from the preliminary "
            "geotechnical assessment, the cost and time impact is to be addressed through "
            "the standard change order process rather than borne solely by either party",
        ],
        dispute_terms=[
            "Disputes resolved by mediation, then binding arbitration, under the "
            "law of the project jurisdiction",
        ],
        warranty_terms=[
            "Defects liability period: 12 months from practical completion",
            "Contractor liable for defect rectification at no additional cost "
            "during the warranty period",
        ],
        force_majeure_terms=[
            "Standard force majeure clause covering acts of God, natural disasters, "
            "and government-ordered restrictions",
            "Force majeure notification required within 14 days of occurrence",
        ],
        compliance_terms=[
            "Contractor shall perform all work in compliance with applicable local "
            "building codes and occupational health and safety law",
            "All works subject to inspection and sign-off by the local building authority",
        ],
        security_terms=[
            "Performance Bond: 10% of contract value",
            "Insurance Requirements: General Liability minimum USD 5 Million per occurrence",
        ],
        ld_terms=[
            "Schedule Delay Penalties: 0.4% of contract value per week of delay, "
            "capped at 5% total",
        ],
        evaluation_criteria=[
            "Technical Capability: 35%",
            "Financial: 45%",
            "HSE & Compliance: 20%",
        ],
        classification="CONSTRUCTION CONTRACT",
        expected_profile="MEDIUM risk / PROCEED_WITH_CAUTION (bid_decision: YES)",
    ),
}

if __name__ == "__main__":
    import os
    out_dir = os.path.dirname(os.path.abspath(__file__))
    for name, cfg in SCENARIOS.items():
        build_tender_pdf(cfg, os.path.join(out_dir, f"tender-{name}.pdf"))
