// Kata Observer — inscription d'un utilisateur et ses réactions
const php = String.raw

export default {
  id: 'observer',
  name: 'Observer',
  nameFr: 'Observateur',
  family: 'Comportemental',
  guru: 'https://refactoring.guru/fr/design-patterns/observer',
  summary: 'Une action centrale dont la liste de réactions ne cesse de s’allonger.',

  problem:
    "Une action centrale (inscription, commande payée) déclenche une liste de réactions qui ne cesse de s'allonger : mail, Slack, CRM, statistiques… La classe métier dépend de tout le monde, et chaque nouvelle réaction oblige à la rouvrir.",

  kid:
    "Le coach du club de foot envoie « match annulé » à la liste des inscrits. Il n'appelle pas chaque parent un par un : il publie l'info, et chacun réagit à sa façon (l'un reste à la maison, l'autre file au cinéma). Pour ne plus être prévenu, on se désinscrit de la liste, et le coach ne change rien à sa façon de faire.",

  technical:
    "Observer sépare celui qui annonce un événement (le **sujet**) de ceux qui y réagissent (les **abonnés**). Le sujet garde une liste d'abonnés derrière une interface commune et les prévient quand l'événement se produit. Il ne connaît ni leur nombre ni ce qu'ils font : ajouter une réaction, c'est ajouter un abonné.",

  example: {
    intro: "Généralisé, le sujet devient un dispatcher d'événements : on s'abonne à une classe d'événement, et on publie un objet qui transporte les données.",
    code: php`final class OrderPaid
{
    public function __construct(public readonly int $orderId) {}
}

final class EventDispatcher
{
    /** @var array<class-string, list<callable>> */
    private array $listeners = [];

    public function listen(string $event, callable $listener): void
    {
        $this->listeners[$event][] = $listener;
    }

    public function dispatch(object $event): void
    {
        foreach ($this->listeners[$event::class] ?? [] as $listener) {
            $listener($event);
        }
    }
}

$dispatcher->listen(OrderPaid::class, fn (OrderPaid $e) => $stock->release($e->orderId));
$dispatcher->listen(OrderPaid::class, fn (OrderPaid $e) => $invoices->generate($e->orderId));

$dispatcher->dispatch(new OrderPaid(42));`,
  },

  symfony: {
    text: "C'est l'EventDispatcher : le kernel publie `kernel.request`, `kernel.response`… et tes listeners s'y abonnent. Doctrine fait de même avec `postPersist` ou `preUpdate`. Dans ton code, tu publies un événement métier et chaque réaction devient un listener autonome :",
    code: php`#[AsEventListener(event: UserRegistered::class)]
final class SendWelcomeMail
{
    public function __construct(private MailerInterface $mailer) {}

    public function __invoke(UserRegistered $event): void
    {
        // …
    }
}`,
  },

  avoid: [
    "Quand l'ordre des réactions compte vraiment (débiter, puis expédier) : un enchaînement explicite est plus honnête qu'une liste d'abonnés dont l'ordre est implicite.",
    "Quand une réaction doit pouvoir annuler l'action ou renvoyer un résultat : ce n'est plus une notification, c'est un appel.",
    "Avec une seule réaction qui ne bougera pas : un appel direct reste lisible, alors qu'un événement cache le flux à qui lit le code.",
  ],

  steps: [
    {
      title: 'Refactoriser',
      kind: 'Refacto',
      brief:
        "`RegistrationService` enregistre l'utilisateur, puis envoie lui-même le mail de bienvenue et le message Slack. Transforme le service en **sujet** : il enregistre, puis prévient ses abonnés, sans savoir qui ils sont. Le mail et Slack deviennent des abonnés.",
      contract: [
        "Interface `UserRegisteredListener` avec `onUserRegistered(User $user): void`",
        "`WelcomeMailListener(Mailer $mailer)` : sujet `'Bienvenue !'` ; `SlackListener(Slack $slack)` : message `'Nouvel inscrit : <email>'`",
        "`RegistrationService::__construct(UserRepository $users)` et `subscribe(UserRegisteredListener $listener): void`",
        "`register()` enregistre, puis prévient les abonnés dans l'ordre d'abonnement",
        "`User`, `UserRepository`, `Mailer`, `Slack` et `Newsletter` sont fournis, ne les modifie pas",
      ],
      starter: php`<?php
declare(strict_types=1);

// --- Infrastructure fournie (ne pas modifier) ---------------------------
final class User
{
    public function __construct(
        public readonly string $email,
        public readonly bool $optIn = false, // accepte la newsletter
    ) {
    }
}

final class UserRepository
{
    /** @var list<User> */
    public array $saved = [];

    public function save(User $user): void
    {
        $this->saved[] = $user;
    }
}

final class Mailer
{
    /** @var list<array{to: string, subject: string}> */
    public array $sent = [];

    public function send(string $to, string $subject): void
    {
        $this->sent[] = ['to' => $to, 'subject' => $subject];
    }
}

final class Slack
{
    /** @var list<string> */
    public array $messages = [];

    public function post(string $message): void
    {
        $this->messages[] = $message;
    }
}

final class Newsletter
{
    /** @var list<string> */
    public array $subscribers = [];

    public function subscribe(string $email): void
    {
        $this->subscribers[] = $email;
    }
}

// --- À refactoriser ------------------------------------------------------
// L'inscription fait tout elle-même. Chaque nouvelle réaction
// (CRM, statistiques…) ajoute une dépendance et une ligne ici.
final class RegistrationService
{
    public function __construct(
        private UserRepository $users,
        private Mailer $mailer,
        private Slack $slack,
    ) {
    }

    public function register(string $email, bool $optIn = false): User
    {
        $user = new User($email, $optIn);
        $this->users->save($user);

        $this->mailer->send($user->email, 'Bienvenue !');
        $this->slack->post("Nouvel inscrit : {$user->email}");

        return $user;
    }
}

// --- Bac à sable : exécuté par « Exécuter », ignoré pendant la validation ---
if (!defined('KATA_TESTING')) {
    $mailer = new Mailer();
    $slack = new Slack();
    $service = new RegistrationService(new UserRepository(), $mailer, $slack);
    $service->register('ana@exemple.fr');
    print_r($mailer->sent);
    print_r($slack->messages);
}
`,
      tests: [
        {
          label: 'Le contrat existe',
          code: php`return Expect::all(
    Expect::that(interface_exists('UserRegisteredListener'), 'UserRegisteredListener doit être une interface'),
    Expect::implements('WelcomeMailListener', 'UserRegisteredListener'),
    Expect::implements('SlackListener', 'UserRegisteredListener'),
    Expect::that(method_exists('RegistrationService', 'subscribe'), 'RegistrationService doit avoir une méthode subscribe()'),
);`,
        },
        {
          label: "L'inscription enregistre l'utilisateur, même sans abonné",
          code: php`$repo = new UserRepository();
$user = (new RegistrationService($repo))->register('ana@exemple.fr');
return Expect::all(
    Expect::same('ana@exemple.fr', $user->email, 'Email de l’utilisateur renvoyé'),
    Expect::same(1, count($repo->saved), 'Utilisateurs enregistrés'),
);`,
        },
        {
          label: 'Le mail de bienvenue est un abonné',
          code: php`$mailer = new Mailer();
$service = new RegistrationService(new UserRepository());
$service->subscribe(new WelcomeMailListener($mailer));
$service->register('ana@exemple.fr');
return Expect::same([['to' => 'ana@exemple.fr', 'subject' => 'Bienvenue !']], $mailer->sent, 'Mails envoyés');`,
        },
        {
          label: 'Slack est un abonné',
          code: php`$slack = new Slack();
$service = new RegistrationService(new UserRepository());
$service->subscribe(new SlackListener($slack));
$service->register('ana@exemple.fr');
return Expect::same(['Nouvel inscrit : ana@exemple.fr'], $slack->messages, 'Messages Slack');`,
        },
        {
          label: "Les abonnés sont prévenus dans l'ordre, après l'enregistrement",
          code: php`$repo = new UserRepository();
$trace = new ArrayObject();
$spy = fn (string $name) => new class ($name, $trace, $repo) implements UserRegisteredListener {
    public function __construct(private string $name, private ArrayObject $trace, private UserRepository $repo) {}
    public function onUserRegistered(User $user): void
    {
        $this->trace[] = $this->name . ' voit ' . count($this->repo->saved) . ' inscrit(s)';
    }
};
$service = new RegistrationService($repo);
$service->subscribe($spy('A'));
$service->subscribe($spy('B'));
$service->register('ana@exemple.fr');
return Expect::same(['A voit 1 inscrit(s)', 'B voit 1 inscrit(s)'], $trace->getArrayCopy(), 'Ordre des notifications');`,
        },
        {
          label: 'RegistrationService ne dépend plus du mail ni de Slack',
          code: php`return Expect::all(
    Expect::same(['UserRepository'], Expect::constructorTypes('RegistrationService'), 'Dépendances du constructeur'),
    Expect::ignores('RegistrationService', ['mailer', 'slack'], 'le sujet ne doit pas connaître ses abonnés'),
);`,
        },
      ],
      hints: [
        "Le sujet a besoin de deux choses : une liste (`private array $listeners = []`) et une méthode pour s'y ajouter (`subscribe()`).",
        "Chaque bloc de réaction de `register()` déménage dans la méthode `onUserRegistered()` d'un listener, avec la dépendance dont il a besoin (le `Mailer` ou `Slack`) dans son constructeur.",
        "Après `$this->users->save($user);` : `foreach ($this->listeners as $listener) { $listener->onUserRegistered($user); }`.",
      ],
      solution: php`<?php
declare(strict_types=1);

// … User, UserRepository, Mailer, Slack et Newsletter inchangés …

interface UserRegisteredListener
{
    public function onUserRegistered(User $user): void;
}

final class WelcomeMailListener implements UserRegisteredListener
{
    public function __construct(private Mailer $mailer)
    {
    }

    public function onUserRegistered(User $user): void
    {
        $this->mailer->send($user->email, 'Bienvenue !');
    }
}

final class SlackListener implements UserRegisteredListener
{
    public function __construct(private Slack $slack)
    {
    }

    public function onUserRegistered(User $user): void
    {
        $this->slack->post("Nouvel inscrit : {$user->email}");
    }
}

final class RegistrationService
{
    /** @var list<UserRegisteredListener> */
    private array $listeners = [];

    public function __construct(private UserRepository $users)
    {
    }

    public function subscribe(UserRegisteredListener $listener): void
    {
        $this->listeners[] = $listener;
    }

    public function register(string $email, bool $optIn = false): User
    {
        $user = new User($email, $optIn);
        $this->users->save($user);

        foreach ($this->listeners as $listener) {
            $listener->onUserRegistered($user);
        }

        return $user;
    }
}
`,
      solutionNote:
        "Le service ne dépend plus que de son dépôt. Chaque réaction est une petite classe testable seule, et on la branche ou débranche sans toucher au métier. Le prix à payer : en lisant `register()`, on ne voit plus ce qui se passe après l'enregistrement. C'est pour ça qu'on nomme bien les listeners.",
    },
    {
      title: 'Ajouter une réaction',
      kind: 'Ajout',
      brief:
        "Le marketing veut inscrire à la newsletter les utilisateurs qui l'ont acceptée (`$user->optIn`). Ajoute cette réaction **sans modifier** `RegistrationService`.",
      contract: [
        "Classe `NewsletterListener(Newsletter $newsletter)` qui implémente `UserRegisteredListener`",
        "N'inscrit que les utilisateurs avec `optIn === true`",
        "`RegistrationService` garde un seul paramètre de constructeur",
      ],
      tests: [
        {
          label: 'NewsletterListener est un abonné',
          code: php`return Expect::implements('NewsletterListener', 'UserRegisteredListener');`,
        },
        {
          label: "N'inscrit que les volontaires",
          code: php`$newsletter = new Newsletter();
$listener = new NewsletterListener($newsletter);
$listener->onUserRegistered(new User('ana@exemple.fr', optIn: true));
$listener->onUserRegistered(new User('bob@exemple.fr', optIn: false));
return Expect::same(['ana@exemple.fr'], $newsletter->subscribers, 'Abonnés à la newsletter');`,
        },
        {
          label: 'Toutes les réactions cohabitent',
          code: php`$mailer = new Mailer();
$slack = new Slack();
$newsletter = new Newsletter();
$service = new RegistrationService(new UserRepository());
$service->subscribe(new WelcomeMailListener($mailer));
$service->subscribe(new SlackListener($slack));
$service->subscribe(new NewsletterListener($newsletter));
$service->register('ana@exemple.fr', true);
$service->register('bob@exemple.fr');
return Expect::all(
    Expect::same(2, count($mailer->sent), 'Mails de bienvenue'),
    Expect::same(2, count($slack->messages), 'Messages Slack'),
    Expect::same(['ana@exemple.fr'], $newsletter->subscribers, 'Abonnés à la newsletter'),
    Expect::same(['UserRepository'], Expect::constructorTypes('RegistrationService'), 'Dépendances de RegistrationService'),
);`,
        },
      ],
      hints: [
        'Même forme que `WelcomeMailListener` : une dépendance au constructeur, une méthode `onUserRegistered()`.',
        "La condition « a accepté la newsletter » appartient au listener, pas au service : c'est sa règle à lui.",
        "`if ($user->optIn) { $this->newsletter->subscribe($user->email); }`",
      ],
      solution: php`final class NewsletterListener implements UserRegisteredListener
{
    public function __construct(private Newsletter $newsletter)
    {
    }

    public function onUserRegistered(User $user): void
    {
        if ($user->optIn) {
            $this->newsletter->subscribe($user->email);
        }
    }
}
`,
      solutionNote:
        "La règle « seulement les volontaires » vit dans le listener : le sujet n'a pas à savoir qui s'intéresse à quoi. Dans Symfony, l'abonnement se ferait par l'attribut `#[AsEventListener]`, et `RegistrationService` publierait un objet `UserRegistered` via l'EventDispatcher.",
    },
  ],
}
