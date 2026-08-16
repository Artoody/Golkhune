function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: "Invalid payload",
        details: result.error.flatten(),
      });
    }

    req.validated = result.data;
    return next();
  };
}

module.exports = { validate };
