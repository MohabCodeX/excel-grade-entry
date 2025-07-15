
/**
 * Normalizes Arabic text by replacing different forms of the same letter with a standard form
 * This helps with searching regardless of the specific character variant used
 */
export const normalizeArabicText = (text: string): string => {
  if (!text) return '';
  
  const replacements: Record<string, string> = {
    'أ': 'ا',
    'إ': 'ا',
    'آ': 'ا',
    'ة': 'ه',
    'ى': 'ي',
    'ؤ': 'و',
    'ئ': 'ي'
  };

  return text
    .split('')
    .map(char => replacements[char] || char)
    .join('');
};

/**
 * Performs a smart search on Arabic text by normalizing both the search term and the target text
 */
export const arabicSmartSearch = (searchTerm: string, targetText: string): boolean => {
  if (!searchTerm || !targetText) return false;
  
  const normalizedSearch = normalizeArabicText(searchTerm.toLowerCase());
  const normalizedTarget = normalizeArabicText(targetText.toLowerCase());
  
  return normalizedTarget.includes(normalizedSearch);
};

/**
 * Sorts an array of strings with Arabic text
 */
export const sortArabicText = (texts: string[]): string[] => {
  return [...texts].sort((a, b) => {
    return normalizeArabicText(a).localeCompare(normalizeArabicText(b), 'ar');
  });
};

/**
 * Filters an array of students based on a search term using Arabic-aware search
 */
export const filterStudentsByName = (students: any[], searchTerm: string, nameField: string = 'name'): any[] => {
  if (!searchTerm) return students;
  
  return students.filter(student => 
    arabicSmartSearch(searchTerm, student[nameField])
  );
};
