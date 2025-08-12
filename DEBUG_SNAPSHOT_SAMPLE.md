# Debug Snapshot Sample

## Search Configuration
- **Phrases**: "react developer", "frontend developer"  
- **Exclude Words**: intern, junior
- **Region**: All regions
- **AND→OR Threshold**: 30 results
- **Company Fallback**: Enabled (default)

## Final Keyword Set Used

### Without Gemini (Original)
```
Keywords: ["react developer", "frontend developer"]
Final search text (AND): "react developer" AND "frontend developer"
Exclude filters: ["intern", "junior"]
```

### With Gemini Expansion (Simulated)
```
Original Keywords: ["react developer", "frontend developer"]
Expanded Keywords: [
  "react developer",           // Original (exact phrase)
  "frontend developer",        // Original (exact phrase)
  "react js developer",        // Strong synonym ✓
  "frontend engineer",         // Strong synonym ✓
  "ui developer",              // Strong synonym ✓
  "javascript developer",      // Strong synonym ✓
  "reactjs developer",         // Weak synonym (user selectable)
  "front-end developer"        // Weak synonym (user selectable)
]
Final count: 6 keywords (capped at reasonable limit)
```

## Tier URLs and Parameters

### Tier A (Title Search)
```
URL: /api/vacancies?text="react developer" AND "frontend developer"&search_field=name&page=0&per_page=50&area=113&period=7&order_by=relevance
Parameters:
- search_field: name
- text: "react developer" AND "frontend developer"
- area: 113 (All regions)
- period: 7 (last week)
- order_by: relevance
```

### Tier B (Description Search)  
```
URL: /api/vacancies?text="react developer" AND "frontend developer"&search_field=description&page=0&per_page=50&area=113&period=7&order_by=relevance
Parameters:
- search_field: description
- text: "react developer" AND "frontend developer" 
- area: 113 (All regions)
- period: 7 (last week)
- order_by: relevance
```

### Tier C (Skills/Company Search)
```
URL: /api/vacancies?text="react developer" AND "frontend developer"&search_field=company_name&page=0&per_page=50&area=113&period=7&order_by=relevance
Parameters:
- search_field: company_name (fallback for skills)
- text: "react developer" AND "frontend developer"
- area: 113 (All regions) 
- period: 7 (last week)
- order_by: relevance
```

## Search Results Summary

### Counts Per Tier
```
Tier A (Title):       found=45,  fetched=45
Tier B (Description): found=120, fetched=50  
Tier C (Skills):      found=200, fetched=50
Total raw results:    365 found, 145 fetched
```

### Filtering Results
```
Hard exclusions applied: 18 vacancies removed
- Excluded "intern": 12 matches
- Excluded "junior": 6 matches

Final merged total: 127 unique vacancies
AND→OR fallback: Not triggered (127 > 30)
```

## Top 5 Merged Vacancies (Sample)

### Vacancy #1
- **Tier**: Title
- **Score**: 45 (title exact match +30, salary +4, recent +3, description match +8)
- **Matched Phrases**: ["react developer"]
- **Title-Start Match**: ✅ Yes
- **Title**: "React Developer - Senior Position"
- **Employer**: "TechCorp Ltd"
- **Salary**: "200,000 - 300,000 RUB"

### Vacancy #2  
- **Tier**: Title
- **Score**: 42 (title exact match +30, description match +6, recent +3, salary +3)
- **Matched Phrases**: ["frontend developer"] 
- **Title-Start Match**: ✅ Yes
- **Title**: "Frontend Developer React/Vue"
- **Employer**: "Digital Agency"
- **Salary**: "150,000 - 250,000 RUB"

### Vacancy #3
- **Tier**: Description
- **Score**: 38 (title contains +15, description match +15, salary +4, recent +2)
- **Matched Phrases**: ["react developer", "frontend developer"]
- **Title-Start Match**: ❌ No
- **Title**: "Senior JavaScript Engineer"
- **Employer**: "StartupX"
- **Salary**: "180,000 - 320,000 RUB"

### Vacancy #4
- **Tier**: Skills
- **Score**: 25 (skills match +12, description match +6, salary +4, recent +3)
- **Matched Phrases**: ["react developer"] (found in key_skills)
- **Title-Start Match**: ❌ No  
- **Title**: "Full Stack Engineer"
- **Employer**: "InnovateTech"
- **Salary**: "160,000 - 280,000 RUB"

### Vacancy #5
- **Tier**: Title
- **Score**: 23 (title contains +15, description match +6, recent +2)
- **Matched Phrases**: ["frontend developer"]
- **Title-Start Match**: ❌ No
- **Title**: "UI/UX Frontend Developer"
- **Employer**: "DesignStudio"
- **Salary**: "120,000 - 180,000 RUB"

## Deterministic Ordering Verification

Vacancies with same scores sorted by:
1. **Relevance Score** (desc): 45 → 42 → 38 → 25 → 23
2. **Posted Date** (desc): Recent postings first within score groups
3. **Salary** (desc): Higher salaries first within date groups  
4. **Employer ID** (asc): Alphabetical employer sorting for final stability
5. **Vacancy ID** (asc): Guaranteed stable sort for pagination consistency

## Pagination Stability

- Page 1 (items 1-50): Always same 50 vacancies in same order
- Page 2 (items 51-100): Deterministic continuation, no duplicates
- Page 3 (items 101-127): Final 27 items, consistent ordering

Cross-page navigation maintains exact position and order.