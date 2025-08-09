import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  onInputChange?: (input: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean;
  maxHeight?: string;
}

export default function Combobox({
  options,
  value = '',
  onChange,
  onInputChange,
  placeholder = 'Search...',
  disabled = false,
  className = '',
  allowCustom = false,
  maxHeight = 'max-h-60'
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter options based on input
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Handle input change
  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onInputChange?.(newValue);
    setHighlightedIndex(-1);
    if (!isOpen) setIsOpen(true);
  };

  // Handle option selection
  const handleSelectOption = (option: ComboboxOption) => {
    setInputValue(option.label);
    onChange(option.value);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  // Handle custom value
  const handleCustomValue = () => {
    if (allowCustom && inputValue.trim()) {
      onChange(inputValue.trim());
      setIsOpen(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          handleSelectOption(filteredOptions[highlightedIndex]);
        } else if (allowCustom && inputValue.trim()) {
          handleCustomValue();
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;

      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  // Handle clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update input when value changes externally
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const clearInput = () => {
    setInputValue('');
    onChange('');
    onInputChange?.('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef} data-testid="combobox-container">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-3 pr-10 text-lg border border-slate-300 rounded-xl 
                     focus:ring-2 focus:ring-primary focus:border-transparent 
                     disabled:bg-slate-100 disabled:text-slate-500 transition-all"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="combobox-listbox"
          aria-activedescendant={highlightedIndex >= 0 ? `option-${highlightedIndex}` : undefined}
          data-testid="combobox-input"
        />
        
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {inputValue && (
            <button
              type="button"
              onClick={clearInput}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
              data-testid="combobox-clear"
            >
              <X size={16} />
            </button>
          )}
          <ChevronDown 
            size={20} 
            className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            data-testid="combobox-arrow"
          />
        </div>
      </div>

      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg"
          data-testid="combobox-dropdown"
        >
          <ul
            ref={listRef}
            className={`py-2 ${maxHeight} overflow-auto`}
            role="listbox"
            id="combobox-listbox"
            data-testid="combobox-options"
          >
            {filteredOptions.length === 0 ? (
              <li 
                className="px-4 py-2 text-slate-500 text-sm"
                data-testid="combobox-no-options"
              >
                {allowCustom && inputValue.trim() ? (
                  <button
                    onClick={handleCustomValue}
                    className="w-full text-left hover:bg-primary-50 hover:text-primary-700 
                               px-2 py-1 rounded transition-colors"
                    data-testid="combobox-custom-option"
                  >
                    Add "{inputValue.trim()}"
                  </button>
                ) : (
                  'No options found'
                )}
              </li>
            ) : (
              filteredOptions.map((option, index) => (
                <li
                  key={`${option.value}-${index}`}
                  id={`option-${index}`}
                  role="option"
                  aria-selected={highlightedIndex === index}
                  className={`px-4 py-2 cursor-pointer transition-colors
                    ${highlightedIndex === index 
                      ? 'bg-primary-50 text-primary-700' 
                      : 'text-slate-700 hover:bg-slate-50'
                    }
                    ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => !option.disabled && handleSelectOption(option)}
                  data-testid={`combobox-option-${index}`}
                >
                  {option.label}
                </li>
              ))
            )}
            
            {allowCustom && inputValue.trim() && !filteredOptions.find(o => o.label === inputValue.trim()) && (
              <li className="border-t border-slate-200 mt-2 pt-2">
                <button
                  onClick={handleCustomValue}
                  className="w-full text-left px-4 py-2 text-primary-600 hover:bg-primary-50 
                             transition-colors text-sm font-medium"
                  data-testid="combobox-add-custom"
                >
                  + Add "{inputValue.trim()}"
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
