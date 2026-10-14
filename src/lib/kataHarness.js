// Construction des scripts PHP exécutés par le moteur des katas.
// Le code de l'utilisateur est écrit dans KATA_FILE puis chargé par un harness
// qui lance les tests et renvoie les résultats en JSON après RESULT_MARKER.

export const KATA_FILE = '/tmp/kata.php'
export const RESULT_MARKER = '@@KATA_RESULT@@'

// Échappe une chaîne JS en littéral PHP entre apostrophes
export const phpStr = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

// Outils disponibles dans le code des tests : chaque test renvoie true (réussi) ou un message d'échec.
const EXPECT = String.raw`
final class Expect
{
    public static function that(bool $cond, string $msg): true|string
    {
        return $cond ? true : $msg;
    }

    public static function same(mixed $expected, mixed $actual, string $what = 'Valeur'): true|string
    {
        return $expected === $actual ? true : sprintf('%s : attendu %s, obtenu %s', $what, self::dump($expected), self::dump($actual));
    }

    public static function near(float $expected, mixed $actual, string $what = 'Valeur'): true|string
    {
        if (!is_int($actual) && !is_float($actual)) {
            return sprintf('%s : un nombre était attendu, obtenu %s', $what, self::dump($actual));
        }
        return abs($expected - $actual) < 0.001 ? true : sprintf('%s : attendu %s, obtenu %s', $what, self::dump($expected), self::dump($actual));
    }

    public static function throws(string $class, callable $fn, string $what = 'Appel'): true|string
    {
        try {
            $fn();
        } catch (Throwable $e) {
            return $e instanceof $class ? true : sprintf('%s : %s attendue, %s levée (« %s »)', $what, $class, $e::class, $e->getMessage());
        }
        return sprintf('%s : une %s était attendue, rien n\'a été levé', $what, $class);
    }

    // Combine plusieurs vérifications : renvoie le premier échec
    public static function all(true|string ...$checks): true|string
    {
        foreach ($checks as $c) {
            if ($c !== true) {
                return $c;
            }
        }
        return true;
    }

    public static function classes(string ...$names): true|string
    {
        foreach ($names as $n) {
            if (!class_exists($n) && !interface_exists($n)) {
                return sprintf('%s introuvable (vérifie le nom, et reste dans l\'espace de noms global)', $n);
            }
        }
        return true;
    }

    public static function implements(string $class, string $interface): true|string
    {
        if (($c = self::classes($class, $interface)) !== true) {
            return $c;
        }
        return in_array($interface, class_implements($class), true) ? true : sprintf('%s doit implémenter %s', $class, $interface);
    }

    // Classes concrètes écrites par l'utilisateur qui implémentent une interface
    public static function implementing(string $interface): array
    {
        return array_values(array_filter(get_declared_classes(), static function (string $c) use ($interface): bool {
            $r = new ReflectionClass($c);
            return $r->isUserDefined() && $r->isInstantiable() && $r->getFileName() === KATA_FILE && $r->implementsInterface($interface);
        }));
    }

    // Tokens PHP d'une classe ou d'une méthode, commentaires et espaces exclus
    public static function tokens(string $class, ?string $method = null): array
    {
        $r = $method ? new ReflectionMethod($class, $method) : new ReflectionClass($class);
        $lines = array_slice(file(KATA_FILE), $r->getStartLine() - 1, $r->getEndLine() - $r->getStartLine() + 1);
        $all = token_get_all("<?php\n" . implode('', $lines));
        return array_values(array_filter($all, static fn ($t) => !is_array($t) || !in_array($t[0], [T_OPEN_TAG, T_COMMENT, T_DOC_COMMENT, T_WHITESPACE], true)));
    }

    // Échoue si la classe/méthode contient un des mots-clés interdits (switch, match, if…)
    public static function without(string $class, ?string $method, array $tokenIds, string $why): true|string
    {
        foreach (self::tokens($class, $method) as $t) {
            if (is_array($t) && in_array($t[0], $tokenIds, true)) {
                return sprintf('%s contient encore « %s » : %s', $method ? "$class::$method()" : $class, $t[1], $why);
            }
        }
        return true;
    }

    // Échoue si la classe mentionne un des mots (hors commentaires), insensible à la casse
    public static function ignores(string $class, array $words, string $why): true|string
    {
        $code = strtolower(implode('', array_map(static fn ($t) => is_array($t) ? $t[1] : $t, self::tokens($class))));
        foreach ($words as $w) {
            if (str_contains($code, strtolower($w))) {
                return sprintf('%s mentionne encore « %s » : %s', $class, $w, $why);
            }
        }
        return true;
    }

    // Types des paramètres du constructeur (noms de classes), pour vérifier les dépendances
    public static function constructorTypes(string $class): array
    {
        $ctor = (new ReflectionClass($class))->getConstructor();
        return $ctor ? array_map(static fn (ReflectionParameter $p) => (string) $p->getType(), $ctor->getParameters()) : [];
    }

    public static function dump(mixed $v): string
    {
        if (is_object($v)) {
            return $v::class;
        }
        if (is_float($v)) {
            return rtrim(rtrim(number_format($v, 4, '.', ''), '0'), '.') ?: '0';
        }
        return preg_replace('/\s+/', ' ', var_export($v, true));
    }
}
`

// Script « Exécuter » : lance le fichier tel quel
export function runScript() {
  return `<?php\nrequire ${phpStr(KATA_FILE)};\n`
}

// Script « Valider » : charge le code, lance chaque test, imprime le JSON des résultats
export function testScript(tests) {
  const list = tests
    .map((t) => `$__tests[] = [${phpStr(t.label)}, static function (): true|string {\n${t.code}\n}];`)
    .join('\n')
  return `<?php
const KATA_FILE = ${phpStr(KATA_FILE)};
const KATA_TESTING = true; // le bac à sable du kata est ignoré pendant la validation
${EXPECT}
$__report = ['loaded' => true, 'loadError' => null, 'stdout' => '', 'results' => []];
ob_start();
try {
    require KATA_FILE;
} catch (Throwable $e) {
    $__report['loaded'] = false;
    $__report['loadError'] = sprintf('%s : %s (ligne %d)', $e::class, $e->getMessage(), $e->getLine());
}
$__report['stdout'] = ob_get_clean();
if ($__report['loaded']) {
    $__tests = [];
${list}
    foreach ($__tests as [$label, $fn]) {
        ob_start();
        try {
            $r = $fn();
            $__report['results'][] = ['label' => $label, 'ok' => $r === true, 'msg' => $r === true ? '' : (string) $r];
        } catch (Throwable $e) {
            $where = $e->getFile() === KATA_FILE ? sprintf(' (ton code, ligne %d)', $e->getLine()) : '';
            $msg = preg_replace('/ (in|on) php-wasm run script( on)? line \\d+/', '', $e->getMessage());
            $__report['results'][] = ['label' => $label, 'ok' => false, 'msg' => sprintf('%s : %s%s', $e::class, $msg, $where)];
        }
        $__report['stdout'] .= ob_get_clean();
    }
}
echo "\\n${RESULT_MARKER}", json_encode($__report, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
`
}

// Sépare la sortie brute en { report, raw } ; report null si le script n'est pas allé au bout (erreur fatale)
export function parseReport(output) {
  const i = output.lastIndexOf(RESULT_MARKER)
  if (i === -1) return { report: null, raw: output.trim() }
  try {
    return { report: JSON.parse(output.slice(i + RESULT_MARKER.length)), raw: output.slice(0, i).trim() }
  } catch {
    return { report: null, raw: output.trim() }
  }
}
