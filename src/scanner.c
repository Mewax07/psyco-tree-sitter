#include "tree_sitter/parser.h"

#include <wctype.h>

// Psyco has no statement terminator. Like `psycoc`, a token that could
// either continue an expression or start a new statement (`*`, `-`, `&`,
// `(`, `[`) only continues it when it is on the same line. When such a
// token starts a new line, emit an invisible terminator first.

enum TokenType {
  STATEMENT_END,
  BLOCK_COMMENT,
  ERROR_SENTINEL,
};

void *tree_sitter_psyco_external_scanner_create(void) { return NULL; }

void tree_sitter_psyco_external_scanner_destroy(void *payload) {}

unsigned tree_sitter_psyco_external_scanner_serialize(void *payload, char *buffer) { return 0; }

void tree_sitter_psyco_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {}

// `/* ... */` comments nest, which a regular expression cannot express.
static bool scan_block_comment(TSLexer *lexer) {
  if (lexer->lookahead != '/') {
    return false;
  }
  lexer->advance(lexer, false);
  if (lexer->lookahead != '*') {
    return false;
  }
  lexer->advance(lexer, false);

  unsigned depth = 1;
  while (!lexer->eof(lexer)) {
    int32_t c = lexer->lookahead;
    lexer->advance(lexer, false);
    if (c == '*' && lexer->lookahead == '/') {
      lexer->advance(lexer, false);
      if (--depth == 0) {
        lexer->mark_end(lexer);
        lexer->result_symbol = BLOCK_COMMENT;
        return true;
      }
    } else if (c == '/' && lexer->lookahead == '*') {
      lexer->advance(lexer, false);
      depth++;
    }
  }
  return false;
}

bool tree_sitter_psyco_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  // Every symbol is valid during error recovery: stay out of the way.
  if (valid_symbols[ERROR_SENTINEL]) {
    return false;
  }

  bool newline = false;
  while (iswspace(lexer->lookahead)) {
    if (lexer->lookahead == '\n') {
      newline = true;
    }
    lexer->advance(lexer, true);
  }

  if (valid_symbols[STATEMENT_END] && newline) {
    switch (lexer->lookahead) {
      case '*':
      case '-':
      case '&':
      case '(':
      case '[':
        lexer->mark_end(lexer);
        lexer->result_symbol = STATEMENT_END;
        return true;
      default:
        break;
    }
  }

  return valid_symbols[BLOCK_COMMENT] && scan_block_comment(lexer);
}
