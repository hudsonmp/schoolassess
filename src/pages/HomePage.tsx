import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] text-center p-4">
      <h1 className="text-5xl font-bold mb-6 text-primary">SchoolAssess</h1>
      <p className="text-xl mb-8 max-w-2xl text-muted-foreground">
        Making insurance claims for educational institutions more <strong className="text-primary">secure</strong>, <strong className="text-primary">precise</strong>, and <strong className="text-primary">fast</strong>.
      </p>
      <p className="mb-10 max-w-lg text-muted-foreground">
        Streamline your school asset management and disaster recovery with our AI-powered assessment platform.
        Ensure accurate valuations before incidents occur and expedite claims processing when it matters most.
      </p>
      <div className="space-y-4 md:space-y-0 md:space-x-4">
        <Button size="lg" onClick={() => navigate('/login')} className="w-full md:w-auto">
          Insurance Portal Login
        </Button>
        {/* <Button size="lg" variant="outline" onClick={() => navigate('/learn-more')} className="w-full md:w-auto">
          Learn More
        </Button> */}
      </div>
      <div className="mt-16 text-sm text-muted-foreground">
        <p>Designed for simplicity and efficiency on mobile devices.</p>
      </div>
    </div>
  );
};

export default HomePage; 