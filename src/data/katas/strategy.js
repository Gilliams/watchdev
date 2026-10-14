// Kata Strategy — frais de port d'une boutique en ligne
const php = String.raw

export default {
  id: 'strategy',
  name: 'Strategy',
  nameFr: 'Stratégie',
  family: 'Comportemental',
  guru: 'https://refactoring.guru/fr/design-patterns/strategy',
  summary: 'Un switch qui grossit à chaque variante d’un même calcul.',

  problem:
    "Un `switch` (ou une cascade de `if`) choisit entre plusieurs façons de faire la même chose, et il grossit à chaque nouvelle variante. Chaque ajout modifie une classe déjà testée et en production, et toutes les règles vivent mélangées dans la même méthode.",

  kid:
    "Pour aller à l'école, tu peux marcher, prendre ton vélo ou le bus. Le but ne change pas (arriver à l'école), seule la façon d'y aller change. Au lieu d'un gros cahier « si vélo alors…, si bus alors… », chaque moyen de transport a sa propre fiche, et le matin tu prends la fiche dont tu as besoin.",

  technical:
    "Strategy extrait chaque variante d'un algorithme dans sa propre classe, derrière une **interface commune**. Le code qui utilise l'algorithme (le contexte) ne connaît que l'interface : il reçoit les stratégies et délègue à la bonne. Ajouter une variante revient à ajouter une classe, sans rouvrir le contexte : c'est le principe ouvert/fermé appliqué.",

  example: {
    intro: "Un export de rapport en CSV ou en JSON. `ReportExporter` ne sait pas formater : il demande à chaque format s'il est concerné.",
    code: php`interface ExportFormat
{
    public function supports(string $format): bool;
    public function export(array $rows): string;
}

final class CsvExport implements ExportFormat
{
    public function supports(string $format): bool { return $format === 'csv'; }

    public function export(array $rows): string
    {
        return implode(PHP_EOL, array_map(fn (array $r) => implode(';', $r), $rows));
    }
}

final class JsonExport implements ExportFormat
{
    public function supports(string $format): bool { return $format === 'json'; }

    public function export(array $rows): string { return json_encode($rows); }
}

final class ReportExporter
{
    /** @param iterable<ExportFormat> $formats */
    public function __construct(private iterable $formats) {}

    public function export(array $rows, string $format): string
    {
        foreach ($this->formats as $f) {
            if ($f->supports($format)) {
                return $f->export($rows);
            }
        }
        throw new InvalidArgumentException("Format non géré : $format");
    }
}`,
  },

  symfony: {
    text: "Tu l'utilises déjà : les normalizers du Serializer exposent `supportsNormalization()` et le Serializer délègue au premier qui répond oui, comme les authenticators avec `supports()`. Pour tes propres stratégies, un tag automatique sur l'interface et `#[AutowireIterator]` injectent toutes les implémentations, sans rien déclarer à la main.",
    code: php`#[AutoconfigureTag('app.shipping')]
interface ShippingStrategy { /* … */ }

final class ShippingCalculator
{
    public function __construct(
        #[AutowireIterator('app.shipping')] iterable $strategies,
    ) { /* … */ }
}`,
  },

  avoid: [
    "Deux variantes stables qui ne bougeront plus : un `if` ou un `match` reste plus lisible qu'une interface et deux classes.",
    "Des variantes qui ne diffèrent que par des valeurs (un taux, un libellé) : une table de configuration suffit, pas besoin d'une classe par ligne.",
    "Si l'appelant doit connaître le détail de chaque stratégie pour choisir, l'abstraction ne cache rien : revois la frontière.",
  ],

  steps: [
    {
      title: 'Refactoriser',
      kind: 'Refacto',
      brief:
        "La boutique calcule ses frais de port dans un `switch`. Chaque transporteur a pourtant **sa propre règle** (formule au kilo, tranches, forfait plafonné). Sors chaque transporteur dans sa stratégie, et fais de `ShippingCalculator` un simple aiguilleur qui ne connaît plus aucun transporteur.",
      contract: [
        "Interface `ShippingStrategy` avec `carrier(): string` et `cost(float $weightKg): float`",
        "Classes `ColissimoShipping` (`'colissimo'`), `ChronopostShipping` (`'chronopost'`) et `RelayShipping` (`'relais'`)",
        "`ShippingCalculator::__construct(iterable $strategies)`, `cost()` garde sa signature",
        'Mêmes tarifs, mêmes exceptions, tout dans l’espace de noms global',
      ],
      starter: php`<?php
declare(strict_types=1);

// Frais de port d'une boutique en ligne.
// Chaque nouveau transporteur ajoute un « case »… et un risque de casser les autres.
final class ShippingCalculator
{
    public function cost(string $carrier, float $weightKg): float
    {
        switch ($carrier) {
            case 'colissimo':
                return round(4.95 + 0.80 * $weightKg, 2);

            case 'chronopost':
                if ($weightKg <= 1) {
                    return 9.90;
                }
                if ($weightKg <= 5) {
                    return 14.90;
                }
                return round(14.90 + 1.20 * ($weightKg - 5), 2);

            case 'relais':
                if ($weightKg > 20) {
                    throw new DomainException('Point relais : 20 kg maximum');
                }
                return 3.50;

            default:
                throw new InvalidArgumentException("Transporteur inconnu : $carrier");
        }
    }
}

// --- Bac à sable : exécuté par « Exécuter », ignoré pendant la validation ---
if (!defined('KATA_TESTING')) {
    $calculator = new ShippingCalculator();
    echo 'Colissimo 2 kg : ', $calculator->cost('colissimo', 2.0), ' €', PHP_EOL;
    echo 'Chronopost 7 kg : ', $calculator->cost('chronopost', 7.0), ' €', PHP_EOL;
}
`,
      tests: [
        {
          label: 'Le contrat existe',
          code: php`return Expect::all(
    Expect::that(interface_exists('ShippingStrategy'), 'ShippingStrategy doit être une interface'),
    Expect::implements('ColissimoShipping', 'ShippingStrategy'),
    Expect::implements('ChronopostShipping', 'ShippingStrategy'),
    Expect::implements('RelayShipping', 'ShippingStrategy'),
);`,
        },
        {
          label: 'Chaque transporteur calcule son propre tarif',
          code: php`return Expect::all(
    Expect::same('colissimo', (new ColissimoShipping())->carrier(), 'ColissimoShipping::carrier()'),
    Expect::near(6.55, (new ColissimoShipping())->cost(2.0), 'Colissimo 2 kg'),
    Expect::near(9.90, (new ChronopostShipping())->cost(0.5), 'Chronopost 0,5 kg'),
    Expect::near(14.90, (new ChronopostShipping())->cost(5.0), 'Chronopost 5 kg'),
    Expect::near(17.30, (new ChronopostShipping())->cost(7.0), 'Chronopost 7 kg'),
    Expect::near(3.50, (new RelayShipping())->cost(19.0), 'Relais 19 kg'),
    Expect::throws(DomainException::class, fn () => (new RelayShipping())->cost(21.0), 'Relais 21 kg'),
);`,
        },
        {
          label: 'Le calculateur délègue à la bonne stratégie',
          code: php`$calc = new ShippingCalculator([new ColissimoShipping(), new ChronopostShipping(), new RelayShipping()]);
return Expect::all(
    Expect::near(6.55, $calc->cost('colissimo', 2.0), 'cost(colissimo, 2 kg)'),
    Expect::near(17.30, $calc->cost('chronopost', 7.0), 'cost(chronopost, 7 kg)'),
    Expect::near(3.50, $calc->cost('relais', 1.0), 'cost(relais, 1 kg)'),
    Expect::throws(InvalidArgumentException::class, fn () => $calc->cost('pigeon', 1.0), 'cost(pigeon)'),
);`,
        },
        {
          label: "Le calculateur n'utilise que les stratégies reçues",
          code: php`$only = new ShippingCalculator([new ColissimoShipping()]);
$custom = new ShippingCalculator([new class implements ShippingStrategy {
    public function carrier(): string { return 'test'; }
    public function cost(float $weightKg): float { return 42.0; }
}]);
return Expect::all(
    Expect::throws(InvalidArgumentException::class, fn () => $only->cost('chronopost', 1.0), 'Calculateur sans Chronopost'),
    Expect::near(42.0, $custom->cost('test', 1.0), 'Stratégie inconnue du calculateur'),
);`,
        },
        {
          label: 'ShippingCalculator ne connaît plus aucun transporteur',
          code: php`return Expect::all(
    Expect::without('ShippingCalculator', null, [T_SWITCH, T_MATCH], 'le choix doit venir des stratégies'),
    Expect::ignores('ShippingCalculator', ['colissimo', 'chronopost', 'relais'], 'le calculateur ne doit plus nommer de transporteur'),
);`,
        },
      ],
      hints: [
        "Commence par l'interface : quelles sont les deux questions qu'on pose à un transporteur ? « Qui es-tu ? » et « Combien pour ce poids ? ».",
        "Chaque `case` devient le corps de la méthode `cost()` d'une classe. Le `default` (transporteur inconnu) reste dans le calculateur.",
        "Dans le constructeur, range les stratégies dans un tableau indexé par `carrier()`. `cost()` devient une simple recherche : `$this->strategies[$carrier] ?? throw new InvalidArgumentException(…)`.",
      ],
      solution: php`<?php
declare(strict_types=1);

interface ShippingStrategy
{
    public function carrier(): string;

    public function cost(float $weightKg): float;
}

final class ColissimoShipping implements ShippingStrategy
{
    public function carrier(): string
    {
        return 'colissimo';
    }

    public function cost(float $weightKg): float
    {
        return round(4.95 + 0.80 * $weightKg, 2);
    }
}

final class ChronopostShipping implements ShippingStrategy
{
    public function carrier(): string
    {
        return 'chronopost';
    }

    public function cost(float $weightKg): float
    {
        return match (true) {
            $weightKg <= 1 => 9.90,
            $weightKg <= 5 => 14.90,
            default => round(14.90 + 1.20 * ($weightKg - 5), 2),
        };
    }
}

final class RelayShipping implements ShippingStrategy
{
    public function carrier(): string
    {
        return 'relais';
    }

    public function cost(float $weightKg): float
    {
        if ($weightKg > 20) {
            throw new DomainException('Point relais : 20 kg maximum');
        }
        return 3.50;
    }
}

final class ShippingCalculator
{
    /** @var array<string, ShippingStrategy> */
    private array $strategies = [];

    /** @param iterable<ShippingStrategy> $strategies */
    public function __construct(iterable $strategies)
    {
        foreach ($strategies as $strategy) {
            $this->strategies[$strategy->carrier()] = $strategy;
        }
    }

    public function cost(string $carrier, float $weightKg): float
    {
        $strategy = $this->strategies[$carrier]
            ?? throw new InvalidArgumentException("Transporteur inconnu : $carrier");

        return $strategy->cost($weightKg);
    }
}
`,
      solutionNote:
        "Le calculateur indexe les stratégies par `carrier()` une seule fois, puis fait une recherche en O(1). Chaque règle tarifaire vit seule dans sa classe : on peut la tester isolément et la modifier sans risque pour les autres. Le `match` de Chronopost reste dans sa stratégie : il exprime une règle interne, pas un aiguillage entre transporteurs.",
    },
    {
      title: 'Ajouter un transporteur',
      kind: 'Ajout',
      brief:
        "Le marketing vient de signer avec DHL Express : **12,00 € + 2,00 € par kg**, et DHL refuse les colis de **plus de 30 kg**. Ajoute-le sans toucher à `ShippingCalculator`. Si ton refacto est bon, c'est une classe et rien d'autre.",
      contract: [
        "Classe `DhlShipping` qui implémente `ShippingStrategy`, code transporteur `'dhl'`",
        "Au-delà de 30 kg : `DomainException`",
        "`ShippingCalculator` ne mentionne toujours aucun transporteur",
      ],
      tests: [
        {
          label: 'DhlShipping respecte le contrat',
          code: php`return Expect::all(
    Expect::implements('DhlShipping', 'ShippingStrategy'),
    Expect::same('dhl', (new DhlShipping())->carrier(), 'DhlShipping::carrier()'),
);`,
        },
        {
          label: 'Le tarif DHL est correct',
          code: php`return Expect::all(
    Expect::near(16.00, (new DhlShipping())->cost(2.0), 'DHL 2 kg'),
    Expect::near(72.00, (new DhlShipping())->cost(30.0), 'DHL 30 kg'),
    Expect::throws(DomainException::class, fn () => (new DhlShipping())->cost(30.5), 'DHL 30,5 kg'),
);`,
        },
        {
          label: 'DHL passe par le calculateur sans le modifier',
          code: php`$calc = new ShippingCalculator([new ColissimoShipping(), new DhlShipping()]);
return Expect::all(
    Expect::near(16.00, $calc->cost('dhl', 2.0), 'cost(dhl, 2 kg)'),
    Expect::near(6.55, $calc->cost('colissimo', 2.0), 'cost(colissimo, 2 kg)'),
    Expect::ignores('ShippingCalculator', ['dhl'], 'ajouter un transporteur ne doit pas rouvrir le calculateur'),
);`,
        },
      ],
      hints: [
        'Inspire-toi de `RelayShipping` : une règle de plafond, puis le calcul.',
        "Tu n'as qu'une classe à écrire. Si tu ouvres `ShippingCalculator`, c'est que l'étape 1 n'est pas finie.",
        "`if ($weightKg > 30) { throw new DomainException('DHL : 30 kg maximum'); }` puis `return round(12.00 + 2.00 * $weightKg, 2);`",
      ],
      solution: php`final class DhlShipping implements ShippingStrategy
{
    public function carrier(): string
    {
        return 'dhl';
    }

    public function cost(float $weightKg): float
    {
        if ($weightKg > 30) {
            throw new DomainException('DHL : 30 kg maximum');
        }
        return round(12.00 + 2.00 * $weightKg, 2);
    }
}
`,
      solutionNote:
        "Une classe ajoutée, zéro ligne modifiée ailleurs : c'est tout l'intérêt du pattern. Dans Symfony, grâce au tag automatique sur l'interface, la nouvelle stratégie serait même injectée sans toucher à la configuration.",
    },
  ],
}
