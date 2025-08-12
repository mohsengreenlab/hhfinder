# Exact Phrase Search Implementation

## Current Implementation Status: ✅ IMPLEMENTED

### How Exact Phrase Search Works

When the "Use exact phrases" toggle is enabled in Step 3:

#### 1. Title Tier (search_field=name) ✅
- **Keywords with quotes**: Sent directly to HH.ru API as quoted strings
- **Keywords without quotes**: Automatically wrapped in quotes
- **Example**: `react developer` becomes `"react developer"`
- **API behavior**: HH.ru treats quoted strings as exact phrase matches

#### 2. Description Tier (search_field=description) ✅
- **Same behavior as Title tier**
- **Keywords are wrapped in quotes** for exact phrase matching
- **Searches in**: vacancy requirement and responsibility text
- **API behavior**: Enforces exact phrase matches in job descriptions

#### 3. Skills Tier (Client-Side Enhancement) ✅
- **API Search**: Uses either `company_name` fallback (default) or `name` (when fallback disabled)
- **Client-Side Processing**: After receiving results from API:
  ```typescript
  // Exact phrase matching in key_skills
  const skillsText = vacancy.key_skills?.map(skill => skill.name?.toLowerCase()).join(' ') || '';
  const hasExactPhrase = exactKeywords.some(keyword => 
    skillsText.includes(keyword.toLowerCase())
  );
  ```
- **Match Detection**: Performs exact substring matching within skill names
- **Scoring**: Awards points for exact phrase matches found in skills

### Code Implementation Details

#### Quote Wrapping Logic
```typescript
// In client/src/steps/Step4Viewer.tsx
const searchText = useAnd 
  ? keywordTexts.map(k => filters.useExactPhrases && !k.includes('"') ? `"${k}"` : k).join(' AND ')
  : keywordTexts.map(k => filters.useExactPhrases && !k.includes('"') ? `"${k}"` : k).join(' OR ');
```

#### Skills Tier Client-Side Matching
```typescript
matchedKeywords: keywordTexts.filter(keyword => {
  const skills = vacancy.key_skills?.map((skill: any) => skill.name?.toLowerCase()).join(' ') || '';
  return skills.includes(keyword.toLowerCase());
})
```

### User Experience

1. **Toggle Location**: Step 3 - Search Options section
2. **Visual Feedback**: Switch control with explanation text
3. **Persistence**: Setting saved to localStorage for future searches
4. **Debug Mode**: Shows final keyword strings sent to API

### API Integration

- **HH.ru Support**: Full support for quoted exact phrases in `name` and `description` search fields
- **Fallback Handling**: Skills tier relies on client-side detection since HH.ru doesn't support `search_field=skills`
- **Performance**: No additional API calls required - exact phrase logic integrated into existing tier structure

### Testing Verification

To verify exact phrase behavior:
1. Enable "Use exact phrases" toggle
2. Search for `"react developer"` 
3. Check debug console for quoted keywords in API URLs
4. Verify "Skills match" badges appear only for vacancies with exact phrase matches in key_skills

### Limitations

- **Skills API**: HH.ru doesn't support direct skills field searching, requiring client-side detection
- **Phrase Complexity**: Complex nested quotes may need manual handling
- **Performance**: Client-side skills matching adds minimal processing overhead