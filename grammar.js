module.exports = grammar({
    name: "psyco",
    extras: ($) => [/\s/, $.comment],
    rules: {
        source_file: ($) => repeat($._item),
        _item: ($) => choice($.function, $.struct, $.enum, $.const, $.static),
        function: ($) =>
            seq(
                optional($.attribute),
                "fn",
                field("name", $.identifier),
                "(",
                optional($.parameters),
                ")",
                optional(seq("->", $.type)),
                $.block,
            ),
        struct: ($) =>
            seq(
                "struct",
                field("name", $.identifier),
                "{",
                repeat($.field),
                "}",
            ),
        enum: ($) =>
            seq(
                "enum",
                field("name", $.identifier),
                "{",
                repeat($.identifier),
                "}",
            ),
        const: ($) =>
            seq(
                "const",
                field("name", $.identifier),
                ":",
                $.type,
                "=",
                $.expression,
            ),
        static: ($) =>
            seq(
                "static",
                optional("mut"),
                field("name", $.identifier),
                ":",
                $.type,
                optional(seq("=", $.expression)),
            ),
        field: ($) => seq(field("name", $.identifier), ":", $.type),
        parameters: ($) => seq($.parameter, repeat(seq(",", $.parameter))),
        parameter: ($) =>
            seq(optional("mut"), field("name", $.identifier), ":", $.type),
        type: ($) =>
            choice(
                $.primitive_type,
                $.reference_type,
                $.raw_pointer_type,
                $.array_type,
                $.slice_type,
                $.named_type,
            ),
        primitive_type: ($) =>
            choice(
                "Int",
                "i8",
                "i16",
                "i32",
                "i64",
                "u8",
                "u16",
                "u32",
                "u64",
                "usize",
                "isize",
                "Bool",
                "bool",
                "Str",
            ),
        reference_type: ($) => seq("&", optional("mut"), $.type),
        raw_pointer_type: ($) => seq("*", choice("const", "mut"), $.type),
        array_type: ($) => seq("[", $.type, ";", $.expression, "]"),
        slice_type: ($) => seq("&", optional("mut"), "[", $.type, "]"),
        named_type: ($) => $.identifier,
        block: ($) => seq("{", repeat($._statement), "}"),
        _statement: ($) =>
            choice(
                $.let_statement,
                $.return_statement,
                $.expression_statement,
                $.block,
            ),
        let_statement: ($) =>
            seq(
                "let",
                optional("mut"),
                $.identifier,
                optional(seq(":", $.type)),
                optional(seq("=", $.expression)),
            ),
        return_statement: ($) => seq("return", optional($.expression)),
        expression_statement: ($) => $.expression,
        expression: ($) =>
            choice(
                $.integer,
                $.string,
                $.boolean,
                $.identifier,
                $.binary_expression,
                $.call_expression,
                $.field_expression,
            ),
        binary_expression: ($) =>
            prec.left(1, seq($.expression, $.operator, $.expression)),
        operator: ($) =>
            choice(
                "+",
                "-",
                "*",
                "/",
                "%",
                "==",
                "!=",
                "<",
                "<=",
                ">",
                ">=",
                "&",
                "|",
                "^",
                "<<",
                ">>",
            ),
        call_expression: ($) =>
            seq(
                field("function", $.identifier),
                "(",
                optional($.arguments),
                ")",
            ),
        arguments: ($) => seq($.expression, repeat(seq(",", $.expression))),
        field_expression: ($) => seq($.expression, ".", $.identifier),
        integer: ($) => /[0-9]+/,
        string: ($) => /"[^"]*"/,
        boolean: ($) => choice("true", "false"),
        identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,
        attribute: ($) => seq("#", "[", $.identifier, "]"),
        comment: ($) =>
            token(
                choice(
                    seq("//", /.*/),
                    seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"),
                ),
            ),
    },
});
