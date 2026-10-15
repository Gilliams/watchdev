// Kata Decorator — le glacier de Gino
import { callerTest } from '../../lib/kataHarness.js'

const php = String.raw

export default {
  id: 'decorator',
  version: 2,
  name: 'Decorator',
  nameFr: 'Décorateur',
  family: 'Structurel',
  guru: 'https://refactoring.guru/fr/design-patterns/decorator',
  summary: 'Des options greffées à coups de booléens et de if.',

  problem:
    "Une classe se voit greffer des options à coups de booléens dans son constructeur. Chaque nouvelle option ajoute un paramètre et des `if` un peu partout, on ne peut pas prendre deux fois la même option, et l'ordre est figé dans le code.",

  kid:
    "Une boule de glace à la vanille. Tu peux ajouter du chocolat, puis de la chantilly, puis des vermicelles. Ça reste une glace : chaque garniture se pose par-dessus sans changer la boule d'en dessous. Tu peux même mettre deux fois du chocolat, et c'est toi qui choisis l'ordre.",

  technical:
    "Decorator enveloppe un objet dans un autre qui a **la même interface**. L'enveloppe reçoit l'objet « intérieur » dans son constructeur, fait son petit ajout (avant ou après), et lui délègue le reste. Comme l'enveloppe a le même type que ce qu'elle contient, l'appelant ne voit pas la différence : on empile autant de couches qu'on veut, dans l'ordre qu'on veut.",

  example: {
    intro: "En préproduction, tous les mails doivent partir vers l'équipe QA. Plutôt qu'un `if (env === 'preprod')` dans le mailer, on l'enveloppe.",
    code: php`interface Mailer
{
    public function send(string $to, string $subject): void;
}

final class SmtpMailer implements Mailer
{
    public function send(string $to, string $subject): void
    {
        // envoi réel
    }
}

final class RedirectingMailer implements Mailer
{
    public function __construct(private Mailer $inner, private string $redirectTo) {}

    public function send(string $to, string $subject): void
    {
        // petit ajout : on change le destinataire, puis on délègue
        $this->inner->send($this->redirectTo, "[pour $to] $subject");
    }
}

// En préprod, et seulement là :
$mailer = new RedirectingMailer(new SmtpMailer(), 'qa@exemple.fr');`,
  },

  symfony: {
    text: "Symfony décore ses propres services en permanence : en dev, le profiler enveloppe l'EventDispatcher pour tracer les événements, et `RetryableHttpClient` enveloppe un client HTTP pour réessayer. Pour décorer un de tes services sans toucher à ceux qui l'utilisent :",
    code: php`#[AsDecorator(decorates: Mailer::class)]
final class RedirectingMailer implements Mailer
{
    public function __construct(
        #[AutowireDecorated] private Mailer $inner,
    ) {}

    // …
}`,
  },

  avoid: [
    "Une interface avec beaucoup de méthodes : chaque décorateur doit toutes les redéléguer, le code devient du copier-coller. Signe qu'il faut une interface plus petite.",
    "Quand l'ordre des couches change le résultat et que personne ne le sait, l'empilement devient un piège. Compose les couches à un seul endroit, bien visible.",
    "Des options qui ne font qu'ajouter un prix fixe pourraient tenir dans une simple liste. Le décorateur prend tout son sens quand une couche change vraiment le comportement (tu le verras à l'étape 2).",
  ],

  steps: [
    {
      title: 'Refactoriser',
      kind: 'Refacto',
      brief:
        "Gino tient un glacier. Sa caisse calcule le prix d'une glace avec une case à cocher par garniture : chocolat, chantilly, vermicelles. Ce matin, un enfant demande **double chocolat** : la caisse ne sait pas faire. Et à chaque nouvelle garniture, il faut rouvrir la classe pour ajouter un booléen et deux `if`. Transforme chaque garniture en **couche** qu'on pose sur la glace : elle ajoute son prix et son nom, et laisse la glace d'en dessous faire le reste.",
      contract: [
        "`IceCream` devient une interface avec `price(): float` et `describe(): string`",
        "`Vanilla` : la boule de base, 2,50 €, décrite `'Vanille'`",
        "`Chocolate` (+0,80 €, `', chocolat'`), `WhippedCream` (+0,60 €, `', chantilly'`), `Sprinkles` (+0,40 €, `', vermicelles'`) : chacune reçoit la glace qu'elle recouvre dans son constructeur",
        'Plus aucun `if` ni booléen dans les garnitures',
        "Le code appelant `demo()` doit continuer de tourner : c'est lui qui compose la glace, adapte-le",
      ],
      starter: php`<?php
declare(strict_types=1);

// La caisse du glacier de Gino.
// Une case à cocher par garniture : impossible de prendre deux fois du chocolat,
// et chaque nouvelle garniture ajoute un booléen et deux « if ».
final class IceCream
{
    public function __construct(
        private bool $chocolate = false,
        private bool $whippedCream = false,
        private bool $sprinkles = false,
    ) {
    }

    public function price(): float
    {
        $price = 2.50; // la boule vanille
        if ($this->chocolate) {
            $price += 0.80;
        }
        if ($this->whippedCream) {
            $price += 0.60;
        }
        if ($this->sprinkles) {
            $price += 0.40;
        }
        return $price;
    }

    public function describe(): string
    {
        $text = 'Vanille';
        if ($this->chocolate) {
            $text .= ', chocolat';
        }
        if ($this->whippedCream) {
            $text .= ', chantilly';
        }
        if ($this->sprinkles) {
            $text .= ', vermicelles';
        }
        return $text;
    }
}

// --- Code appelant : le ticket de caisse ---
// Lancé par « Exécuter » et vérifié par les tests : adapte-le si tu changes l'API.
function demo(): void
{
    $iceCream = new IceCream(chocolate: true, whippedCream: true);
    echo $iceCream->describe(), ' : ', $iceCream->price(), ' €', PHP_EOL;
}

if (!defined('KATA_TESTING')) {
    demo();
}
`,
      tests: [
        {
          label: 'Le contrat existe',
          code: php`return Expect::all(
    Expect::that(interface_exists('IceCream'), 'IceCream doit être une interface'),
    Expect::implements('Vanilla', 'IceCream'),
    Expect::implements('Chocolate', 'IceCream'),
    Expect::implements('WhippedCream', 'IceCream'),
    Expect::implements('Sprinkles', 'IceCream'),
);`,
        },
        {
          label: 'La boule seule',
          code: php`$glace = new Vanilla();
return Expect::all(
    Expect::near(2.50, $glace->price(), 'Prix de la vanille'),
    Expect::same('Vanille', $glace->describe(), 'Description de la vanille'),
);`,
        },
        {
          label: 'Chaque garniture ajoute son prix et son nom',
          code: php`return Expect::all(
    Expect::near(3.30, (new Chocolate(new Vanilla()))->price(), 'Vanille + chocolat'),
    Expect::same('Vanille, chocolat', (new Chocolate(new Vanilla()))->describe(), 'Description vanille + chocolat'),
    Expect::near(3.10, (new WhippedCream(new Vanilla()))->price(), 'Vanille + chantilly'),
    Expect::near(2.90, (new Sprinkles(new Vanilla()))->price(), 'Vanille + vermicelles'),
);`,
        },
        {
          label: 'Les garnitures s’empilent dans l’ordre choisi',
          code: php`$glace = new Sprinkles(new WhippedCream(new Chocolate(new Vanilla())));
return Expect::all(
    Expect::near(4.30, $glace->price(), 'Prix de la glace complète'),
    Expect::same('Vanille, chocolat, chantilly, vermicelles', $glace->describe(), 'Description'),
    Expect::same('Vanille, chantilly, chocolat', (new Chocolate(new WhippedCream(new Vanilla())))->describe(), 'Chantilly posée avant le chocolat'),
);`,
        },
        {
          label: 'Double chocolat, enfin possible',
          code: php`$glace = new Chocolate(new Chocolate(new Vanilla()));
return Expect::all(
    Expect::near(4.10, $glace->price(), 'Prix du double chocolat'),
    Expect::same('Vanille, chocolat, chocolat', $glace->describe(), 'Description du double chocolat'),
);`,
        },
        {
          label: 'Une garniture se pose sur n’importe quelle glace',
          code: php`if (!interface_exists('IceCream')) {
    return 'IceCream doit d\'abord être une interface';
}
$sorbet = new class implements IceCream {
    public function price(): float { return 2.00; }
    public function describe(): string { return 'Sorbet citron'; }
};
$glace = new Chocolate($sorbet);
return Expect::all(
    Expect::near(2.80, $glace->price(), 'Sorbet + chocolat'),
    Expect::same('Sorbet citron, chocolat', $glace->describe(), 'Description sorbet + chocolat'),
);`,
        },
        {
          label: 'Plus de cases à cocher',
          code: php`return Expect::all(
    Expect::same([], Expect::constructorTypes('Vanilla'), 'Paramètres du constructeur de Vanilla'),
    Expect::same(['IceCream'], Expect::constructorTypes('Chocolate'), 'Paramètres du constructeur de Chocolate'),
    Expect::same(['IceCream'], Expect::constructorTypes('WhippedCream'), 'Paramètres du constructeur de WhippedCream'),
    Expect::same(['IceCream'], Expect::constructorTypes('Sprinkles'), 'Paramètres du constructeur de Sprinkles'),
    Expect::without('Chocolate', null, [T_IF], 'une garniture ne décide rien, elle s’ajoute'),
    Expect::without('WhippedCream', null, [T_IF], 'une garniture ne décide rien, elle s’ajoute'),
    Expect::without('Sprinkles', null, [T_IF], 'une garniture ne décide rien, elle s’ajoute'),
);`,
        },
        callerTest,
      ],
      hints: [
        "Commence par l'interface : à une glace, la caisse ne demande que deux choses, son prix et sa description. L'ancienne classe devient l'interface `IceCream`, et la boule de base devient `Vanilla`.",
        "Une garniture **est** une glace (elle implémente `IceCream`) et **contient** une glace (reçue dans son constructeur). Elle demande le prix à celle qu'elle recouvre, puis ajoute le sien.",
        "Dans `Chocolate` : `return $this->iceCream->price() + 0.80;` et `return $this->iceCream->describe() . ', chocolat';`. Puis dans `demo()` : `$iceCream = new WhippedCream(new Chocolate(new Vanilla()));`.",
      ],
      solution: php`<?php
declare(strict_types=1);

interface IceCream
{
    public function price(): float;

    public function describe(): string;
}

final class Vanilla implements IceCream
{
    public function price(): float
    {
        return 2.50;
    }

    public function describe(): string
    {
        return 'Vanille';
    }
}

final class Chocolate implements IceCream
{
    public function __construct(private IceCream $iceCream)
    {
    }

    public function price(): float
    {
        return $this->iceCream->price() + 0.80;
    }

    public function describe(): string
    {
        return $this->iceCream->describe() . ', chocolat';
    }
}

final class WhippedCream implements IceCream
{
    public function __construct(private IceCream $iceCream)
    {
    }

    public function price(): float
    {
        return $this->iceCream->price() + 0.60;
    }

    public function describe(): string
    {
        return $this->iceCream->describe() . ', chantilly';
    }
}

final class Sprinkles implements IceCream
{
    public function __construct(private IceCream $iceCream)
    {
    }

    public function price(): float
    {
        return $this->iceCream->price() + 0.40;
    }

    public function describe(): string
    {
        return $this->iceCream->describe() . ', vermicelles';
    }
}

function demo(): void
{
    $iceCream = new WhippedCream(new Chocolate(new Vanilla()));
    echo $iceCream->describe(), ' : ', $iceCream->price(), ' €', PHP_EOL;
}

if (!defined('KATA_TESTING')) {
    demo();
}
`,
      solutionNote:
        "Chaque garniture tient en quelques lignes et ne connaît que l'interface. Le double chocolat devient possible sans rien prévoir, et la description suit l'ordre d'empilement. C'est maintenant la caisse (le code appelant) qui compose la glace, au lieu que la glace connaisse toutes les garnitures.",
    },
    {
      title: 'Ajouter deux nouveautés',
      kind: 'Ajout',
      brief:
        "L'été arrive. Gino lance le **coulis de fraise** (+0,70 €) et un **happy hour** de 16 h à 17 h : la glace à moitié prix. Ajoute ces deux couches sans toucher aux classes existantes. Petite subtilité : le happy hour divise tout ce qu'il recouvre. Posé en dernier, toute la glace est à moitié prix ; posé avant la chantilly, la chantilly reste plein tarif.",
      contract: [
        "`StrawberrySauce` : +0,70 €, ajoute `', coulis de fraise'`",
        "`HappyHour` : divise par deux le prix de ce qu'il recouvre, ajoute `' (happy hour)'` à la description",
        'Les deux implémentent `IceCream` et reçoivent la glace qu’ils recouvrent',
        'Aucune classe existante ne change',
      ],
      tests: [
        {
          label: 'Les deux nouveautés sont des glaces',
          code: php`return Expect::all(
    Expect::implements('StrawberrySauce', 'IceCream'),
    Expect::implements('HappyHour', 'IceCream'),
);`,
        },
        {
          label: 'Le coulis de fraise',
          code: php`$glace = new StrawberrySauce(new Vanilla());
return Expect::all(
    Expect::near(3.20, $glace->price(), 'Vanille + coulis'),
    Expect::same('Vanille, coulis de fraise', $glace->describe(), 'Description vanille + coulis'),
);`,
        },
        {
          label: 'Le happy hour divise toute la glace',
          code: php`$glace = new HappyHour(new WhippedCream(new Chocolate(new Vanilla())));
return Expect::all(
    Expect::near(1.95, $glace->price(), 'Glace chocolat chantilly en happy hour'),
    Expect::same('Vanille, chocolat, chantilly (happy hour)', $glace->describe(), 'Description'),
);`,
        },
        {
          label: 'L’ordre des couches change le prix',
          code: php`$avant = new WhippedCream(new HappyHour(new Chocolate(new Vanilla())));
$apres = new HappyHour(new WhippedCream(new Chocolate(new Vanilla())));
return Expect::all(
    Expect::near(2.25, $avant->price(), 'Happy hour posé avant la chantilly (chantilly plein tarif)'),
    Expect::near(1.95, $apres->price(), 'Happy hour posé en dernier'),
);`,
        },
      ],
      hints: [
        '`StrawberrySauce` est une garniture comme les autres : copie `Chocolate` et change le prix et le nom.',
        "`HappyHour` a la même forme, mais au lieu d'ajouter, il **transforme** ce que renvoie la glace qu'il recouvre.",
        "`return $this->iceCream->price() / 2;` et `return $this->iceCream->describe() . ' (happy hour)';`",
      ],
      solution: php`final class StrawberrySauce implements IceCream
{
    public function __construct(private IceCream $iceCream)
    {
    }

    public function price(): float
    {
        return $this->iceCream->price() + 0.70;
    }

    public function describe(): string
    {
        return $this->iceCream->describe() . ', coulis de fraise';
    }
}

final class HappyHour implements IceCream
{
    public function __construct(private IceCream $iceCream)
    {
    }

    public function price(): float
    {
        return $this->iceCream->price() / 2;
    }

    public function describe(): string
    {
        return $this->iceCream->describe() . ' (happy hour)';
    }
}
`,
      solutionNote:
        "Deux classes ajoutées, aucune modifiée. Le happy hour montre la vraie force du pattern : une couche ne fait pas qu'ajouter, elle peut transformer tout ce qu'elle recouvre. C'est aussi son piège : l'ordre des couches change le résultat. Dans Symfony, c'est l'option `priority` de `#[AsDecorator]` qui fixe cet ordre.",
    },
  ],
}
