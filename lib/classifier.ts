export type DocType = 'CONTRACT' | 'SPECIFICATION' | 'BOQ' | 'DRAWING' | 'ADDENDUM';

export interface ClassificationResult {
  doc_type: DocType;
  confidence: number;
}

export function classifyDocument(text: string): ClassificationResult {
  const lowerText = text.toLowerCase();

  const keywords: Record<DocType, string[]> = {
    CONTRACT: [
      'agreement',
      'contract',
      'terms and conditions',
      'scope of work',
      'payment',
      'parties',
      'hereinafter',
    ],
    SPECIFICATION: [
      'specification',
      'specifications',
      'shall be',
      'requirements',
      'material',
      'dimensions',
      'standard',
      'quality',
    ],
    BOQ: [
      'bill of quantities',
      'boq',
      'rate',
      'unit price',
      'quantity',
      'total cost',
      'item',
      'description',
    ],
    DRAWING: [
      'drawing',
      'plan',
      'section',
      'elevation',
      'scale',
      'dimension',
      'detail',
      'architectural',
      'structural',
      'layout',
    ],
    ADDENDUM: [
      'addendum',
      'amendment',
      'modification',
      'change order',
      'revision',
      'supplement',
    ],
  };

  const scores: Record<DocType, number> = {
    CONTRACT: 0,
    SPECIFICATION: 0,
    BOQ: 0,
    DRAWING: 0,
    ADDENDUM: 0,
  };

  for (const [docType, keywordList] of Object.entries(keywords)) {
    for (const keyword of keywordList) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerText.match(regex);
      scores[docType as DocType] += matches ? matches.length : 0;
    }
  }

  // Normalize scores
  const maxScore = Math.max(...Object.values(scores));
  const normalizedScores: Record<DocType, number> = {} as Record<DocType, number>;

  for (const docType in scores) {
    normalizedScores[docType as DocType] = maxScore > 0 ? scores[docType as DocType] / maxScore : 0;
  }

  // Find the document type with highest score
  let topDocType: DocType = 'CONTRACT';
  let topScore = normalizedScores.CONTRACT;

  for (const [docType, score] of Object.entries(normalizedScores)) {
    if (score > topScore) {
      topScore = score;
      topDocType = docType as DocType;
    }
  }

  // If no clear winner, default to CONTRACT with lower confidence
  if (topScore < 0.3) {
    return {
      doc_type: 'CONTRACT',
      confidence: 0.4,
    };
  }

  return {
    doc_type: topDocType,
    confidence: Math.min(topScore, 0.95), // Cap at 0.95
  };
}
