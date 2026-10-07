/**
 * Tree-sitter grammar for Psyco (`.psy`), following the `psycoc` parser.
 *
 * Statements have no terminator: like `psycoc`, an expression keeps going
 * when the next token can continue it.
 */

const PREC = {
  or: 1,
  and: 2,
  compare: 3,
  bitor: 4,
  bitxor: 5,
  bitand: 6,
  shift: 7,
  additive: 8,
  multiplicative: 9,
  cast: 10,
  unary: 11,
  postfix: 12,
};

const PRIMITIVES = [
  'Int', 'i8', 'i16', 'i32', 'i64', 'isize',
  'u8', 'u16', 'u32', 'u64', 'usize',
  'Bool', 'bool', 'Str',
];

const INT_SUFFIX = choice('u8', 'u16', 'u32', 'u64', 'usize', 'i8', 'i16', 'i32', 'i64', 'isize');

const ASSIGN_OPS = ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='];

function commaSep(rule) {
  return optional(seq(rule, repeat(seq(',', rule)), optional(',')));
}

module.exports = grammar({
  name: 'psyco',

  extras: $ => [/\s/, $.line_comment, $.block_comment],

  word: $ => $.identifier,

  externals: $ => [$._statement_end, $.block_comment, $._error_sentinel],

  conflicts: $ => [
    // `x {` is a struct literal or the body of `if`/`while`/`for`/`match`.
    [$._expression, $.struct_expression],
  ],

  rules: {
    source_file: $ => seq(optional($.inner_attribute), repeat($._item)),

    _item: $ => seq(
      choice(
        $.function_item,
        $.struct_item,
        $.enum_item,
        $.impl_item,
        $.static_item,
        $.const_item,
        $.import_item,
      ),
      optional(';'),
    ),

    // ---- attributes ----------------------------------------------------

    inner_attribute: $ => seq('#', '!', '[', $.identifier, ']'),

    attribute: $ => seq(
      '#', '[',
      field('name', $.identifier),
      optional(seq('(', $.integer_literal, ')')),
      ']',
    ),

    // ---- items ---------------------------------------------------------

    function_item: $ => seq(
      repeat($.attribute),
      'fn',
      field('name', $.identifier),
      field('parameters', $.parameters),
      optional(seq('->', field('return_type', $._type))),
      field('body', $.block),
    ),

    parameters: $ => seq('(', commaSep(choice($.parameter, $.self_parameter)), ')'),

    parameter: $ => seq(
      optional($.mutable_specifier),
      field('pattern', $.identifier),
      ':',
      field('type', $._type),
    ),

    self_parameter: $ => seq(optional(seq('&', optional($.mutable_specifier))), $.self),

    struct_item: $ => seq(
      repeat($.attribute),
      'struct',
      field('name', alias($.identifier, $.type_identifier)),
      field('body', $.field_declaration_list),
    ),

    field_declaration_list: $ => seq('{', commaSep($.field_declaration), '}'),

    field_declaration: $ => seq(
      field('name', alias($.identifier, $.field_identifier)),
      ':',
      field('type', $._type),
    ),

    enum_item: $ => seq(
      'enum',
      field('name', alias($.identifier, $.type_identifier)),
      optional(seq(':', field('repr', $._type))),
      field('body', $.enum_variant_list),
    ),

    enum_variant_list: $ => seq('{', commaSep($.enum_variant), '}'),

    enum_variant: $ => seq(
      field('name', $.identifier),
      optional(seq('=', field('value', $._expression))),
    ),

    impl_item: $ => seq(
      'impl',
      field('type', alias($.identifier, $.type_identifier)),
      field('body', $.declaration_list),
    ),

    declaration_list: $ => seq('{', repeat(seq($.function_item, optional(';'))), '}'),

    static_item: $ => seq(
      repeat($.attribute),
      'static',
      optional($.mutable_specifier),
      field('name', $.identifier),
      ':',
      field('type', $._type),
      optional(seq('=', field('value', $._expression))),
    ),

    const_item: $ => seq(
      'const',
      field('name', $.identifier),
      optional(seq(':', field('type', $._type))),
      '=',
      field('value', $._expression),
    ),

    import_item: $ => seq('import', field('path', $.string_literal)),

    // ---- types ---------------------------------------------------------

    _type: $ => choice(
      $.primitive_type,
      alias($.identifier, $.type_identifier),
      $.reference_type,
      $.slice_type,
      $.pointer_type,
      $.array_type,
      $.unit_type,
      $.function_type,
    ),

    primitive_type: _ => choice(...PRIMITIVES),

    reference_type: $ => seq('&', optional($.mutable_specifier), field('type', $._type)),

    slice_type: $ => seq('&', optional($.mutable_specifier), '[', field('element', $._type), ']'),

    pointer_type: $ => seq('*', choice('const', $.mutable_specifier), field('type', $._type)),

    array_type: $ => seq('[', field('element', $._type), ';', field('length', $._expression), ']'),

    unit_type: _ => seq('(', ')'),

    function_type: $ => prec.right(seq(
      optional('extern'),
      'fn',
      '(', commaSep($._type), ')',
      optional(seq('->', field('return_type', $._type))),
    )),

    mutable_specifier: _ => 'mut',

    // ---- statements ----------------------------------------------------

    block: $ => seq('{', repeat($._statement), '}'),

    _statement: $ => seq(
      choice(
        $.let_declaration,
        $.return_statement,
        $.while_statement,
        $.loop_statement,
        $.for_statement,
        $.break_statement,
        $.continue_statement,
        $.if_statement,
        $.match_statement,
        $.block,
        $.assignment_statement,
        $.expression_statement,
      ),
      optional(choice(';', $._statement_end)),
    ),

    let_declaration: $ => seq(
      'let',
      optional($.mutable_specifier),
      field('pattern', $.identifier),
      optional(seq(':', field('type', $._type))),
      optional(seq('=', field('value', $._expression))),
    ),

    return_statement: $ => prec.right(seq('return', optional($._expression))),

    while_statement: $ => seq('while', field('condition', $._expression), field('body', $.block)),

    loop_statement: $ => seq('loop', field('body', $.block)),

    for_statement: $ => seq(
      'for',
      field('pattern', $.identifier),
      'in',
      field('start', $._expression),
      '..',
      field('end', $._expression),
      field('body', $.block),
    ),

    break_statement: _ => 'break',

    continue_statement: _ => 'continue',

    if_statement: $ => seq(
      'if',
      field('condition', $._expression),
      field('consequence', $.block),
      optional(field('alternative', $.else_clause)),
    ),

    else_clause: $ => seq('else', choice($.block, $.if_statement)),

    match_statement: $ => seq('match', field('value', $._expression), field('body', $.match_block)),

    match_block: $ => seq('{', repeat($.match_arm), '}'),

    match_arm: $ => seq(
      field('pattern', $.match_pattern),
      '=>',
      field('value', $._statement),
      optional(','),
    ),

    match_pattern: $ => choice(
      $.wildcard_pattern,
      seq($._pattern, repeat(seq('|', $._pattern))),
    ),

    wildcard_pattern: _ => '_',

    _pattern: $ => choice(
      $._literal,
      $.negative_literal,
      $.scoped_identifier,
      $.identifier,
    ),

    negative_literal: $ => seq('-', $.integer_literal),

    assignment_statement: $ => seq(
      field('left', $._expression),
      field('operator', choice(...ASSIGN_OPS)),
      field('right', $._expression),
    ),

    expression_statement: $ => $._expression,

    // ---- expressions ---------------------------------------------------

    _expression: $ => choice(
      $.binary_expression,
      $.unary_expression,
      $.reference_expression,
      $.cast_expression,
      $.call_expression,
      $.field_expression,
      $.index_expression,
      $.struct_expression,
      $.array_expression,
      $.parenthesized_expression,
      $.sizeof_expression,
      $.scoped_identifier,
      $.self,
      $.identifier,
      $._literal,
    ),

    binary_expression: $ => {
      const table = [
        [PREC.or, '||'],
        [PREC.and, '&&'],
        [PREC.compare, choice('==', '!=', '<', '<=', '>', '>=')],
        [PREC.bitor, '|'],
        [PREC.bitxor, '^'],
        [PREC.bitand, '&'],
        [PREC.shift, choice('<<', '>>')],
        [PREC.additive, choice('+', '-', '+%', '-%')],
        [PREC.multiplicative, choice('*', '/', '%', '*%')],
      ];
      return choice(...table.map(([p, op]) => prec.left(p, seq(
        field('left', $._expression),
        field('operator', op),
        field('right', $._expression),
      ))));
    },

    unary_expression: $ => prec(PREC.unary, seq(
      field('operator', choice('-', '!', '~', '*')),
      field('operand', $._expression),
    )),

    reference_expression: $ => prec(PREC.unary, seq(
      choice('&', '&&'),
      optional($.mutable_specifier),
      field('value', $._expression),
    )),

    cast_expression: $ => prec.left(PREC.cast, seq(
      field('value', $._expression),
      'as',
      field('type', $._type),
    )),

    call_expression: $ => prec(PREC.postfix, seq(
      field('function', $._expression),
      field('arguments', $.arguments),
    )),

    arguments: $ => seq('(', commaSep($._expression), ')'),

    field_expression: $ => prec(PREC.postfix, seq(
      field('value', $._expression),
      '.',
      field('field', alias($.identifier, $.field_identifier)),
    )),

    index_expression: $ => prec(PREC.postfix, seq(
      field('value', $._expression),
      '[',
      field('index', choice($._expression, $.range_expression)),
      ']',
    )),

    range_expression: $ => choice(
      seq($._expression, '..', $._expression),
      seq($._expression, '..'),
      seq('..', $._expression),
      '..',
    ),

    struct_expression: $ => seq(
      field('name', alias($.identifier, $.type_identifier)),
      field('body', $.field_initializer_list),
    ),

    field_initializer_list: $ => seq('{', commaSep($.field_initializer), '}'),

    field_initializer: $ => seq(
      field('field', alias($.identifier, $.field_identifier)),
      ':',
      field('value', $._expression),
    ),

    array_expression: $ => seq(
      '[',
      choice(
        seq(field('value', $._expression), ';', field('length', $._expression)),
        commaSep($._expression),
      ),
      ']',
    ),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    sizeof_expression: $ => seq('sizeof', '(', field('type', $._type), ')'),

    scoped_identifier: $ => seq(
      field('path', alias($.identifier, $.type_identifier)),
      '::',
      field('name', $.identifier),
    ),

    self: _ => 'self',

    // ---- literals ------------------------------------------------------

    _literal: $ => choice(
      $.integer_literal,
      $.string_literal,
      $.char_literal,
      $.boolean_literal,
    ),

    integer_literal: _ => token(seq(
      choice(
        /[0-9][0-9_]*/,
        /0x[0-9a-fA-F_]+/,
        /0b[01_]+/,
        /0o[0-7_]+/,
      ),
      optional(INT_SUFFIX),
    )),

    string_literal: $ => seq(
      choice('"', 'c"', 'u"'),
      repeat(choice($.escape_sequence, $.string_content)),
      token.immediate('"'),
    ),

    string_content: _ => token.immediate(prec(1, /[^"\\]+/)),

    escape_sequence: _ => token.immediate(seq('\\', choice(/x[0-9a-fA-F]{2}/, /[^x]/))),

    char_literal: _ => token(seq("'", choice(/[^'\\]/, /\\x[0-9a-fA-F]{2}/, /\\[^x]/), "'")),

    boolean_literal: _ => choice('true', 'false'),

    identifier: _ => /[\p{L}_][\p{L}\p{N}_]*/,

    // ---- comments ------------------------------------------------------

    line_comment: _ => token(seq('//', /.*/)),
  },
});
