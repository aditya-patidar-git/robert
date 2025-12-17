import { diffLines, diffWords, diffChars } from 'diff';

/**
 * Diff Service
 * Provides text comparison and diff generation
 * Used by Prompt Versioning, Template Versioning, etc.
 */
class DiffService {
  /**
   * Compare two versions of text
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   * @param {Object} options - Comparison options
   * @param {string} options.mode - Comparison mode ('lines', 'words', 'chars') - default: 'lines'
   * @returns {Array} Array of diff chunks
   */
  compareVersions(version1, version2, options = {}) {
    const { mode = 'lines' } = options;

    if (!version1) version1 = '';
    if (!version2) version2 = '';

    switch (mode) {
      case 'words':
        return diffWords(version1, version2);
      case 'chars':
        return diffChars(version1, version2);
      case 'lines':
      default:
        return diffLines(version1, version2);
    }
  }

  /**
   * Format diff for display
   * @param {Array} diff - Diff chunks from compareVersions
   * @param {Object} options - Formatting options
   * @param {string} options.format - Format type ('unified', 'side-by-side', 'line-by-line') - default: 'unified'
   * @returns {Object} Formatted diff data
   */
  formatDiff(diff, options = {}) {
    const { format = 'unified' } = options;

    switch (format) {
      case 'side-by-side':
        return this.formatSideBySide(diff);
      case 'line-by-line':
        return this.formatLineByLine(diff);
      case 'unified':
      default:
        return this.formatUnified(diff);
    }
  }

  /**
   * Format diff as unified diff
   * @param {Array} diff - Diff chunks
   * @returns {Object} Unified diff format
   */
  formatUnified(diff) {
    const lines = [];
    let lineNumber1 = 1;
    let lineNumber2 = 1;

    diff.forEach((chunk) => {
      const chunkLines = chunk.value.split('\n');
      
      chunkLines.forEach((line, index) => {
        if (index === chunkLines.length - 1 && line === '') {
          // Skip trailing newline
          return;
        }

        let prefix = ' ';
        if (chunk.added) {
          prefix = '+';
          lines.push({
            type: 'added',
            line: line,
            lineNumber1: null,
            lineNumber2: lineNumber2++,
            prefix: prefix
          });
        } else if (chunk.removed) {
          prefix = '-';
          lines.push({
            type: 'removed',
            line: line,
            lineNumber1: lineNumber1++,
            lineNumber2: null,
            prefix: prefix
          });
        } else {
          lines.push({
            type: 'unchanged',
            line: line,
            lineNumber1: lineNumber1++,
            lineNumber2: lineNumber2++,
            prefix: prefix
          });
        }
      });
    });

    return {
      format: 'unified',
      lines: lines,
      stats: this.calculateStats(diff)
    };
  }

  /**
   * Format diff as side-by-side
   * @param {Array} diff - Diff chunks
   * @returns {Object} Side-by-side diff format
   */
  formatSideBySide(diff) {
    const left = [];
    const right = [];
    let lineNumber = 1;

    diff.forEach((chunk) => {
      const chunkLines = chunk.value.split('\n');
      
      chunkLines.forEach((line, index) => {
        if (index === chunkLines.length - 1 && line === '') {
          // Skip trailing newline
          return;
        }

        if (chunk.added) {
          right.push({
            type: 'added',
            line: line,
            lineNumber: lineNumber++,
            originalLineNumber: null
          });
          // Add empty line to left if needed
          if (left.length < right.length) {
            left.push({
              type: 'empty',
              line: '',
              lineNumber: null,
              originalLineNumber: null
            });
          }
        } else if (chunk.removed) {
          left.push({
            type: 'removed',
            line: line,
            lineNumber: null,
            originalLineNumber: lineNumber++
          });
          // Add empty line to right if needed
          if (right.length < left.length) {
            right.push({
              type: 'empty',
              line: '',
              lineNumber: null,
              originalLineNumber: null
            });
          }
        } else {
          left.push({
            type: 'unchanged',
            line: line,
            lineNumber: lineNumber,
            originalLineNumber: lineNumber
          });
          right.push({
            type: 'unchanged',
            line: line,
            lineNumber: lineNumber,
            originalLineNumber: lineNumber
          });
          lineNumber++;
        }
      });
    });

    // Pad arrays to same length
    while (left.length < right.length) {
      left.push({
        type: 'empty',
        line: '',
        lineNumber: null,
        originalLineNumber: null
      });
    }
    while (right.length < left.length) {
      right.push({
        type: 'empty',
        line: '',
        lineNumber: null,
        originalLineNumber: null
      });
    }

    return {
      format: 'side-by-side',
      left: left,
      right: right,
      stats: this.calculateStats(diff)
    };
  }

  /**
   * Format diff as line-by-line
   * @param {Array} diff - Diff chunks
   * @returns {Object} Line-by-line diff format
   */
  formatLineByLine(diff) {
    const lines = [];
    let lineNumber = 1;

    diff.forEach((chunk) => {
      const chunkLines = chunk.value.split('\n');
      
      chunkLines.forEach((line, index) => {
        if (index === chunkLines.length - 1 && line === '') {
          // Skip trailing newline
          return;
        }

        if (chunk.added) {
          lines.push({
            type: 'added',
            line: line,
            lineNumber: lineNumber++,
            originalLineNumber: null
          });
        } else if (chunk.removed) {
          lines.push({
            type: 'removed',
            line: line,
            lineNumber: null,
            originalLineNumber: lineNumber++
          });
        } else {
          lines.push({
            type: 'unchanged',
            line: line,
            lineNumber: lineNumber,
            originalLineNumber: lineNumber
          });
          lineNumber++;
        }
      });
    });

    return {
      format: 'line-by-line',
      lines: lines,
      stats: this.calculateStats(diff)
    };
  }

  /**
   * Calculate diff statistics
   * @param {Array} diff - Diff chunks
   * @returns {Object} Statistics
   */
  calculateStats(diff) {
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    diff.forEach((chunk) => {
      const lines = chunk.value.split('\n').filter(line => line !== '');
      
      if (chunk.added) {
        added += lines.length;
      } else if (chunk.removed) {
        removed += lines.length;
      } else {
        unchanged += lines.length;
      }
    });

    return {
      added,
      removed,
      unchanged,
      total: added + removed + unchanged,
      changes: added + removed
    };
  }

  /**
   * Highlight changes in text
   * @param {string} text1 - First version
   * @param {string} text2 - Second version
   * @returns {Object} Highlighted text with change markers
   */
  highlightChanges(text1, text2) {
    const diff = this.compareVersions(text1, text2, { mode: 'words' });
    const highlighted1 = [];
    const highlighted2 = [];

    diff.forEach((chunk) => {
      if (chunk.removed) {
        highlighted1.push({
          text: chunk.value,
          type: 'removed'
        });
      } else if (chunk.added) {
        highlighted2.push({
          text: chunk.value,
          type: 'added'
        });
      } else {
        highlighted1.push({
          text: chunk.value,
          type: 'unchanged'
        });
        highlighted2.push({
          text: chunk.value,
          type: 'unchanged'
        });
      }
    });

    return {
      version1: highlighted1,
      version2: highlighted2
    };
  }
}

export default new DiffService();

